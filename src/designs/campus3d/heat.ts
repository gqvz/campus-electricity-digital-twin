// Heatmap: five sequential bins of observed load relative to the busiest building; no data stays neutral grey.
export const HEAT_RAMP = ['#fde8a8', '#f9c06b', '#f08a47', '#d4502e', '#8f2318']
export const HEAT_NONE = '#c9cdd1'
export const heatBin = (watts: number, max: number) =>
  watts > 0 && max > 0 ? Math.min(HEAT_RAMP.length - 1, Math.floor(watts / max * HEAT_RAMP.length)) : -1
