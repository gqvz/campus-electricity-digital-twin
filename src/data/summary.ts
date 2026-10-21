import { caseEnergy, caseWatts } from '../designs/fixtures'
import type { Case } from '../designs/fixtures'

/** What a set of sightings supports. Loads are summed across sightings, which may be at different
 *  times, so the total is a comparison measure and never a concurrent demand figure. */
export type Summary = {
  sightings: number
  watts: number            // sum of avoidable load over all sightings
  verified: number         // sightings with a verified duration
  kwh: number | null       // energy from verified sightings only; null when none are verified
  unverifiedWatts: number  // load from sightings that support watts only
}

export function summarize(cases: Case[]): Summary {
  let watts = 0, verified = 0, kwh = 0, unverifiedWatts = 0
  for (const c of cases) {
    const w = caseWatts(c), e = caseEnergy(c)
    watts += w
    if (e === null) unverifiedWatts += w
    else { verified++; kwh += e }
  }
  return { sightings: cases.length, watts, verified, kwh: verified ? kwh : null, unverifiedWatts }
}

/** Plain-language coverage line for an energy figure. */
export function energyCoverage(s: Summary) {
  if (s.kwh === null) return 'No sighting has a verified duration, so no energy is claimed.'
  const rest = s.sightings - s.verified
  return `From ${s.verified} of ${s.sightings} sighting${s.sightings === 1 ? '' : 's'} with a verified duration${rest ? `; the other ${rest} support watts only` : ''}.`
}

export function formatDay(iso?: string) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}
