#!/usr/bin/env python3
"""Build src/designs/campus/additions.json: buildings missing from OSM, traced from imagery.

  python3 tools/build_additions.py tools/footprint-additions.json src/designs/campus/additions.json

Same pixel->metres convention as refine_footprints.py. Output entries have the shape of the
OSM building records so the app treats them like any other building.
"""
import json, math, sys, datetime
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

def px_to_lonlat(tile, x, y):
    w, h = tile.get('size', [1568, 778])
    k = 111320 * math.cos(math.radians(tile['lat']))
    return (tile['lon'] + (x - w/2) * tile['mpp'] / k, tile['lat'] - (y - h/2) * tile['mpp'] / 111320)

spec = json.load(open(sys.argv[1])); out = []
for bid, s in spec.items():
    geom = unary_union([Polygon([px_to_lonlat(s['tile'], *p) for p in poly]).buffer(0) for poly in s['polygons']])
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    rings = []
    for p in polys:
        p = p.simplify(0.000002)
        rings.append({'role': 'outer', 'wayIds': [], 'coordinates': [[round(x, 7), round(y, 7)] for x, y in list(p.exterior.coords)[:-1]]})
        for h in p.interiors:
            rings.append({'role': 'inner', 'wayIds': [], 'coordinates': [[round(x, 7), round(y, 7)] for x, y in list(h.coords)[:-1]]})
    out.append({'id': bid, 'source': s['source'], 'sourceName': s['name'], 'version': 0, 'updatedAt': datetime.date.today().isoformat(),
                'buildingType': s.get('buildingType', 'yes'), 'levels': s.get('levels'), 'height': None, 'roofShape': None,
                'nameInference': None, 'additionNote': s.get('note'), 'rings': rings})
    print(bid, len(rings), 'rings')
json.dump(out, open(sys.argv[2], 'w'), indent=1)
