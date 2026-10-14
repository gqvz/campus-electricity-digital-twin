import type { ObservationInput } from './observation'

// Offline-first queue: entries wait in IndexedDB until the device is online and signed in.
export type QueuedObservation = { localId: string; input: ObservationInput; photo?: Blob; submit: boolean; createdAt: number }

const DB = 'pulse-drafts', STORE = 'queue'
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 1)
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'localId' })
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})
const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const queueObservation = (item: Omit<QueuedObservation, 'localId' | 'createdAt'>) =>
  run('readwrite', s => s.put({ ...item, localId: crypto.randomUUID(), createdAt: Date.now() } satisfies QueuedObservation))
export const listQueue = () => run<QueuedObservation[]>('readonly', s => s.getAll())
export const removeQueued = (localId: string) => run('readwrite', s => s.delete(localId))
