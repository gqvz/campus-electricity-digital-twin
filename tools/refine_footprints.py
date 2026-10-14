#!/usr/bin/env python3
"""Turn satellite-review shapes (pixel coordinates on a georeferenced screenshot)
into refined building rings.

  python3 tools/refine_footprints.py tools/footprint-refinements.json src/designs/campus/refinements.json

Spec entry:
  { "<building id>": {
      "tile": {"lat": ..., "lon": ..., "mpp": ..., "size": [1568, 778]},   # centre + metres per pixel
      "union": [[x0,y0,x1,y1], ...],      # replace the outline with these rectangles / polygons
      "voids": [[[x,y],...], ...],        # courtyards and lawns subtracted from the OSM outline
      "clip": 3                           # metres the result may extend beyond the OSM outline
  }}
Needs shapely. Pixels are read by eye, so results are approximate (about +/-2 m).
"""
import json, math, sys
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.ops import unary_union

ORIGIN = (77.895, 29.865)
def lonlat_to_local(lon, lat):
    k = 111320 * math.cos(math.radians(ORIGIN[1]))
    return ((lon - ORIGIN[0]) * k, (ORIGIN[1] - lat) * 111320)
def local_to_lonlat(x, y):
    k = 111320 * math.cos(math.radians(ORIGIN[1]))
    return (ORIGIN[0] + x / k, ORIGIN[1] - y / 111320)

def px_to_local(tile, x, y):
    w, h = tile.get('size', [1568, 778])
    k = 111320 * math.cos(math.radians(tile['lat']))
    lon = tile['lon'] + (x - w/2) * tile['mpp'] / k
    lat = tile['lat'] - (y - h/2) * tile['mpp'] / 111320
    return lonlat_to_local(lon, lat)

def load_buildings():
    out = {}
    import glob
    for f in sorted(glob.glob('src/designs/campus/buildings-*.json')):
        for b in json.load(open(f)):
            out[b['id']] = b
    return out

def osm_polygon(b):
    outers = [Polygon([lonlat_to_local(*p) for p in r['coordinates']]).buffer(0) for r in b['rings'] if r['role'] == 'outer']
    inners = [Polygon([lonlat_to_local(*p) for p in r['coordinates']]).buffer(0) for r in b['rings'] if r['role'] == 'inner']
    return unary_union(outers).difference(unary_union(inners)) if inners else unary_union(outers)

def rings_of(geom):
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    rings = []
    for p in polys:
        if p.is_empty or p.area < 4: continue
        p = p.simplify(0.25)
        rings.append({'role': 'outer', 'coordinates': [list(map(lambda v: round(v, 7), local_to_lonlat(*c))) for c in list(p.exterior.coords)[:-1]]})
        for h in p.interiors:
            rings.append({'role': 'inner', 'coordinates': [list(map(lambda v: round(v, 7), local_to_lonlat(*c))) for c in list(h.coords)[:-1]]})
    return rings

def main(spec_path, out_path):
    spec = json.load(open(spec_path)); blds = load_buildings(); out = {}
    for bid, s in spec.items():
        if bid.startswith('_'): continue
        tile = s['tile']; osm = osm_polygon(blds[bid])
        if 'union' in s:
            shapes = []
            for r in s['union']:
                if len(r) == 4 and not isinstance(r[0], list):
                    pts = [(r[0], r[1]), (r[2], r[1]), (r[2], r[3]), (r[0], r[3])]
                else:
                    pts = [tuple(p) for p in r]
                shapes.append(Polygon([px_to_local(tile, *p) for p in pts]).buffer(0))
            geom = unary_union(shapes).intersection(osm.buffer(s.get('clip', 3)))
        else:
            geom = osm
        for v in s.get('voids', []):
            geom = geom.difference(Polygon([px_to_local(tile, *p) for p in v]).buffer(0))
        rings = rings_of(geom)
        # Ground the OSM outline claimed but the satellite shows open (lawns, courtyards between bars).
        open_geom = osm.difference(geom).buffer(-0.5).buffer(0.5)
        open_rings = rings_of(open_geom) if not open_geom.is_empty else []
        before, after = osm.area, geom.area
        print(f"{bid:28s} osm {before:7.0f} m2 -> {after:7.0f} m2 ({after/before:.0%}), {sum(r['role']=='outer' for r in rings)} outer / {sum(r['role']=='inner' for r in rings)} inner")
        out[bid] = {'basis': s.get('basis', 'Satellite-imagery review, approximate'), 'rings': rings, 'open': open_rings}
    json.dump(out, open(out_path, 'w'), indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:3])
