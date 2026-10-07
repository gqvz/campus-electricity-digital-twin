export type Palette = {
  bg: string; surface: string; ink: string; muted: string; border: string; accent: string; onAccent: string;
  scene: string; ground: string; groundSide: string; road: string; lawn: string; tree: string;
  roof: string; front: string; side: string; window: string; line: string; high: string; medium: string;
}
export type CampusTheme = {
  id: 'chromatic'; name: string; display: string; body: string; mono: string; palette: Palette; radius: number;
}

export const chromatic: CampusTheme = {
  id: 'chromatic', name: 'Chromatic', display: 'DM Sans', body: 'DM Sans', mono: 'IBM Plex Mono', radius: 3,
  palette: {
    bg: '#f5eedd', surface: '#fffaf0', ink: '#263e55', muted: '#667276', border: '#bdb9a2',
    accent: '#206889', onAccent: '#ffffff', scene: '#f3e7c9', ground: '#e9d9af', groundSide: '#cfbd8d',
    road: '#fff6dc', lawn: '#b9cc9b', tree: '#3f9074', roof: '#e7c668', front: '#e5a19b', side: '#b97874',
    window: '#596986', line: '#525f70', high: '#d7674a', medium: '#e3bd57',
  },
}
