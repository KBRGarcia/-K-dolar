import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, RATE_OPTIONS } from '../constants/rates'
import { readCache, writeCache } from '../utils/cacheStorage'

const HISTORICAL_RATES_CACHE_KEY = 'k-dolar:historical-rates'

function getNumericRate(rate) {
  const value = rate.promedio ?? rate.venta ?? rate.compra

  return Number(value)
}

function normalizeHistoryItem(item, index, history) {
  const value = getNumericRate(item)
  const previousValue = index > 0 ? getNumericRate(history[index - 1]) : null
  const change = Number.isFinite(previousValue) ? value - previousValue : 0
  const changePercent =
    Number.isFinite(previousValue) && previousValue > 0
      ? (change / previousValue) * 100
      : 0

  return {
    date: item.fecha,
    buy: Number(item.compra),
    sell: Number(item.venta),
    value,
    change,
    changePercent,
  }
}

export function useHistoricalRates(enabled = true) {
  const cachedHistory = readCache(HISTORICAL_RATES_CACHE_KEY, {})
  const [historyById, setHistoryById] = useState(cachedHistory)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isUsingCache, setIsUsingCache] = useState(
    Object.values(cachedHistory).some((history) => history.length > 0),
  )
  const abortControllerRef = useRef(null)
  const didFetchRef = useRef(false)
  const historyRef = useRef(cachedHistory)

  const fetchHistory = useCallback(async () => {
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const histories = await Promise.all(
        RATE_OPTIONS.map(async (option) => {
          const response = await fetch(`${API_BASE_URL}${option.historyEndpoint}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })

          if (!response.ok) {
            throw new Error(`No se pudo consultar el histórico de ${option.title}.`)
          }

          const json = await response.json()

          if (!Array.isArray(json)) {
            throw new Error(`El histórico de ${option.title} no tiene formato válido.`)
          }

          return [
            option.id,
            json
              .filter((item) => item.fecha && Number.isFinite(getNumericRate(item)))
              .map(normalizeHistoryItem),
          ]
        }),
      )

      const normalizedHistory = Object.fromEntries(histories)

      setHistoryById(normalizedHistory)
      historyRef.current = normalizedHistory
      writeCache(HISTORICAL_RATES_CACHE_KEY, normalizedHistory)
      setIsUsingCache(false)
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') return

      const hasCachedHistory = Object.values(historyRef.current).some(
        (history) => history.length > 0,
      )

      setError(
        hasCachedHistory
          ? 'Sin conexión. Mostrando el último histórico guardado.'
          : fetchError.message ||
              'No se pudo consultar el histórico. Verifica tu conexión.',
      )
      setIsUsingCache(hasCachedHistory)
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
        abortControllerRef.current = null
      }
    }
  }, [])

  const hasHistory = useMemo(() => {
    return Object.values(historyById).some((history) => history.length > 0)
  }, [historyById])

  useEffect(() => {
    if (!enabled || didFetchRef.current) return undefined

    didFetchRef.current = true
    fetchHistory()

    return () => {
      const controller = abortControllerRef.current

      abortControllerRef.current = null
      controller?.abort()
    }
  }, [enabled, fetchHistory])

  useEffect(() => {
    const handleOnline = () => {
      if (enabled) {
        fetchHistory()
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, fetchHistory])

  return {
    historyById,
    loading,
    error,
    hasHistory,
    isUsingCache,
    refresh: fetchHistory,
  }
}

export default useHistoricalRates
