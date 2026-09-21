import { create } from 'zustand'

type Store = { selectedId: string; time: number; filter: 'all' | 'priority' | 'audited'; heatmap: boolean; select: (id: string) => void; setTime: (time: number) => void; setFilter: (filter: Store['filter']) => void; setHeatmap: (heatmap: boolean) => void }
export const usePulseStore = create<Store>((set) => ({ selectedId: 'lhc', time: 20.5, filter: 'all', heatmap: true, select: (selectedId) => set({ selectedId }), setTime: (time) => set({ time }), setFilter: (filter) => set({ filter }), setHeatmap: (heatmap) => set({ heatmap }) }))
