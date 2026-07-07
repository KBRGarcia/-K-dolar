export function readCache(key, fallbackValue) {
  if (typeof window === 'undefined') return fallbackValue

  try {
    const cachedValue = window.localStorage.getItem(key)

    return cachedValue ? JSON.parse(cachedValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

export function writeCache(key, value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Cache failures should not block live data rendering.
  }
}
