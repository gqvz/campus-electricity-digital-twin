import { useCallback, useEffect, useState } from 'react'
import { loadCases } from './repository'
import type { CaseSource } from './repository'

export type CasesState =
  | { status: 'loading'; source: null; error: null }
  | { status: 'ready'; source: CaseSource; error: null }
  | { status: 'error'; source: null; error: string }

export function useCases(): CasesState & { reload: () => void } {
  const [state, setState] = useState<CasesState>({ status: 'loading', source: null, error: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState({ status: 'loading', source: null, error: null })
    loadCases().then(
      source => live && setState({ status: 'ready', source, error: null }),
      err => live && setState({ status: 'error', source: null, error: err instanceof Error ? err.message : 'Could not load observations' }),
    )
    return () => { live = false }
  }, [tick])
  return { ...state, reload: useCallback(() => setTick(t => t + 1), []) }
}
