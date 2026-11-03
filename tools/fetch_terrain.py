#!/usr/bin/env python3
"""Estimate bare-earth ground elevation over the campus -> src/designs/campus/elevation.json

  pip install rasterio numpy
  python3 tools/fetch_terrain.py

Sources (range-read from public cloud-optimised GeoTIFFs, nothing is stored):
  * Copernicus GLO-30 DSM (ESA, free with attribution): surface elevation, includes trees and roofs.
  * Meta/WRI high-resolution canopy height (CC BY 4.0): tree height, 1 m.
  * Building heights from the app's own OSM footprints and height estimates.
Model: DSM = smooth quadratic terrain + a * canopy + b * building height, fitted by least
squares over the campus. The ground estimate is DSM - a*canopy - b*building. This is an
estimate of RELATIVE ground height (a few metres of real relief), not a survey.
"""
import json, math, glob, datetime
import numpy as np, rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling

LON0, LON1, LAT0, LAT1 = 77.8885, 77.9040, 29.8590, 29.8738
K = 111320 * math.cos(math.radians(29.865))
DSM = '/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N29_00_E077_00_DEM/Copernicus_DSM_COG_10_N29_00_E077_00_DEM.tif'
CHM = '/vsicurl/https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/123121132.tif'

with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
    with rasterio.open(DSM) as ds:
        w = from_bounds(LON0, LAT0, LON1, LAT1, ds.transform)
        dsm = ds.read(1, window=w, masked=True).astype('float64')
        tf = ds.window_transform(w)
    ny, nx = dsm.shape
    print('DSM window', nx, 'x', ny, 'cell ~', round(abs(tf.a) * K, 1), 'x', round(abs(tf.e) * 111320, 1), 'm')
    with rasterio.open(CHM) as ch:
        from rasterio.warp import transform_bounds
        l, b, r, t = transform_bounds('EPSG:4326', ch.crs, LON0, LAT0, LON1, LAT1)
        wc = from_bounds(l, b, r, t, ch.transform)
        chm = ch.read(1, window=wc, out_shape=(ny, nx), resampling=Resampling.average, masked=True).astype('float64')
chm = np.ma.filled(chm, 0.0); chm = np.clip(chm, 0, 45)
dsm = np.ma.filled(dsm, np.nan)
print('canopy mean %.1f m, max %.1f m' % (chm.mean(), chm.max()))

# local metres, x east / y north from the window centre
xs = LON0 + (np.arange(nx) + .5) * (LON1 - LON0) / nx
ys = LAT1 - (np.arange(ny) + .5) * (LAT1 - LAT0) / ny
X = (xs[None, :] - xs.mean()) * K * np.ones((ny, 1)); Y = (ys[:, None] - ys.mean()) * 111320 * np.ones((1, nx))

# building height coverage per cell from the app's footprints (mean height over the cell)
from shapely.geometry import Polygon, box
bh = np.zeros((ny, nx))
cell_w, cell_h = (LON1 - LON0) / nx, (LAT1 - LAT0) / ny
for f in sorted(glob.glob('src/designs/campus/buildings-*.json')):
    for b in json.load(open(f)):
        outs = [Polygon(r['coordinates']).buffer(0) for r in b['rings'] if r['role'] == 'outer']
        ins = [Polygon(r['coordinates']).buffer(0) for r in b['rings'] if r['role'] == 'inner']
        if not outs: continue
        geom = outs[0]
        for o in outs[1:]: geom = geom.union(o)
        for i in ins: geom = geom.difference(i)
        try: lv = float(b['levels']) if b.get('levels') else 3.0
        except ValueError: lv = 3.0
        height = float(b['height']) if b.get('height') else lv * 3.4
        mnx, mny, mxx, mxy = geom.bounds
        i0, i1 = max(0, int((mnx - LON0) / cell_w)), min(nx - 1, int((mxx - LON0) / cell_w))
        j0, j1 = max(0, int((LAT1 - mxy) / cell_h)), min(ny - 1, int((LAT1 - mny) / cell_h))
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                c = box(LON0 + i * cell_w, LAT1 - (j + 1) * cell_h, LON0 + (i + 1) * cell_w, LAT1 - j * cell_h)
                a = geom.intersection(c).area / c.area
                if a > 0: bh[j, i] += a * height

ok = ~np.isnan(dsm)
terms = [np.ones_like(X), X, Y, X * X, X * Y, Y * Y]
A = np.stack([t[ok] for t in terms] + [chm[ok], bh[ok]], axis=1)
coef, *_ = np.linalg.lstsq(A, dsm[ok], rcond=None)
a_chm, b_bld = coef[6], coef[7]
res = dsm[ok] - A @ coef
print('fit: canopy coefficient %.2f, building coefficient %.2f, residual std %.2f m' % (a_chm, b_bld, res.std()))
# physical bounds: a surface model cannot be lower than the ground, nor read more than the object height
a_use, b_use = float(np.clip(a_chm, 0, 1.0)), float(np.clip(b_bld, 0, 1.0))
ground = dsm - a_use * chm - b_use * bh
ground = np.where(np.isnan(ground), np.nanmean(ground), ground)

# smooth lightly (sigma ~1 cell) to remove speckle
def blur(g, s=1.0):
    r = int(math.ceil(3 * s)); k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * s * s)); k /= k.sum()
    p = np.pad(g, r, mode='edge')
    p = np.apply_along_axis(lambda m: np.convolve(m, k, mode='valid'), 1, p)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode='valid'), 0, p)
ground = blur(ground, 1.0)
print('ground estimate %.1f .. %.1f m (relief %.1f m); raw DSM relief %.1f m' % (ground.min(), ground.max(), ground.max() - ground.min(), np.nanmax(dsm) - np.nanmin(dsm)))

json.dump({
    'source': 'Copernicus GLO-30 DSM minus fitted canopy (Meta/WRI CHM) and building height terms, lightly smoothed',
    'attribution': 'Contains modified Copernicus DEM GLO-30 (ESA); canopy height (c) Meta and World Resources Institute, CC BY 4.0',
    'retrieved': datetime.date.today().isoformat(),
    'note': 'Estimated bare-earth height; relative relief of a few metres, not survey elevation.',
    'fit': {'canopy': round(float(a_chm), 3), 'building': round(float(b_bld), 3), 'residualStd': round(float(res.std()), 2)},
    'origin': {'lon': LON0, 'lat': LAT1}, 'step': {'lon': (LON1 - LON0) / nx, 'lat': (LAT1 - LAT0) / ny},
    'nx': nx, 'ny': ny, 'stepMeters': round(abs(tf.a) * K, 1),
    'cellCentre': True,
    'values': [[round(float(v), 1) for v in row] for row in ground],
}, open('src/designs/campus/elevation.json', 'w'), separators=(',', ':'))
print('wrote elevation.json')
