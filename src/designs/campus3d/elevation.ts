import elevation from '../campus/elevation.json'
import { localToGeographic } from '../buildingGeometry'

// Estimated bare-earth ground height over the campus (see tools/fetch_terrain.py).
// It is a relative surface good to about +/-3 m; the large-scale slope is the signal.
type Grid = { origin: { lon: number; lat: number }; step: { lon: number; lat: number }; nx: number; ny: number; values: number[][] }
const grid = elevation as unknown as Grid
const flat = grid.values.flat()
/** Lowest ground in the sampled area; heights in the scene are metres above this. */
export const datum = Math.min(...flat)
export const reliefMetres = Math.max(...flat) - datum

/** Metres above sea level at a longitude/latitude (bilinear between cell centres). */
export function elevationAt(lon: number, lat: number) {
  const fx = (lon - grid.origin.lon) / grid.step.lon - .5, fy = (grid.origin.lat - lat) / grid.step.lat - .5
  const i0 = Math.max(0, Math.min(grid.nx - 2, Math.floor(fx))), j0 = Math.max(0, Math.min(grid.ny - 2, Math.floor(fy)))
  const tx = Math.max(0, Math.min(1, fx - i0)), ty = Math.max(0, Math.min(1, fy - j0))
  const v = grid.values
  return v[j0][i0]*(1-tx)*(1-ty) + v[j0][i0+1]*tx*(1-ty) + v[j0+1][i0]*(1-tx)*ty + v[j0+1][i0+1]*tx*ty
}

/** Metres above sea level at campus-local metres (x east, z south). */
export function elevationAtLocal(x: number, z: number) {
  const [lon, lat] = localToGeographic([x, z])
  return elevationAt(lon, lat)
}

/** Scene height above the datum, optionally exaggerated. */
export const groundY = (x: number, z: number, scale = 1) => (elevationAtLocal(x, z) - datum) * scale
