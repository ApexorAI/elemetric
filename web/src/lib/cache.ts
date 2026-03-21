/**
 * Module-level SWR-style cache. Survives React re-renders and re-mounts.
 * Entries expire after `ttlMs` milliseconds.
 */

import { useState, useEffect, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  expires: number
}

const store = new Map<string, CacheEntry<unknown>>()

function get<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) { store.delete(key); return null }
  return entry.data as T
}

function set<T>(key: string, data: T, ttlMs: number) {
  store.set(key, { data, expires: Date.now() + ttlMs })
}

function invalidate(key: string) {
  store.delete(key)
}

/**
 * SWR-style hook: returns cached data immediately, re-validates in background.
 * The `key` must be stable — include all relevant params in it.
 */
export function useApiCache<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttlMs = 30_000
): { data: T | null; loading: boolean; error: Error | null; mutate: (d: T) => void; invalidate: () => void } {
  const [data, setData] = useState<T | null>(() => (key ? get<T>(key) : null))
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!key) return
    const cached = get<T>(key)
    if (cached !== null) {
      setData(cached)
      setLoading(false)
      // Background revalidate if older than half of TTL
      const entry = store.get(key)
      if (!entry || entry.expires - Date.now() < ttlMs / 2) {
        fetcherRef.current().then((d) => { set(key, d, ttlMs); setData(d) }).catch(() => {})
      }
      return
    }
    setLoading(true)
    setError(null)
    fetcherRef.current()
      .then((d) => { set(key, d, ttlMs); setData(d) })
      .catch((err) => setError(err as Error))
      .finally(() => setLoading(false))
  }, [key, ttlMs])

  return {
    data,
    loading,
    error,
    mutate: (d: T) => { if (key) set(key, d, ttlMs); setData(d) },
    invalidate: () => { if (key) invalidate(key) },
  }
}
