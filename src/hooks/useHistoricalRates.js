import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, RATE_OPTIONS } from '../constants/rates'
import { readCache, writeCache } from '../utils/cacheStorage'
import { fetchWithTimeout, getFetchErrorMessage } from '../utils/fetchWithTimeout'
import { roundRate } from '../utils/rateFormat'

const HISTORICAL_RATES_CACHE_KEY = 'k-dolar:historical-rates'

function getNumericRate(rate) {
  return roundRate(rate.promedio ?? rate.venta ?? rate.compra)
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
      const results = await Promise.allSettled(
        RATE_OPTIONS.map(async (option) => {
          const response = await fetchWithTimeout(
            `${API_BASE_URL}${option.historyEndpoint}`,
            {
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            },
          )

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
      const histories = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
      const failedOptions = RATE_OPTIONS.filter(
        (_, index) => results[index].status === 'rejected',
      )

      if (histories.length === 0) {
        throw results.find((result) => result.status === 'rejected')?.reason
      }

      const normalizedHistory = {
        ...historyRef.current,
        ...Object.fromEntries(histories),
      }

      setHistoryById(normalizedHistory)
      historyRef.current = normalizedHistory
      writeCache(HISTORICAL_RATES_CACHE_KEY, normalizedHistory)
      setIsUsingCache(failedOptions.length > 0)
      setError(
        failedOptions.length > 0
          ? `No se pudo actualizar el histórico de ${failedOptions
              .map((option) => option.title)
              .join(', ')}. Mostrando el último histórico disponible.`
          : null,
      )
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') return

      const hasCachedHistory = Object.values(historyRef.current).some(
        (history) => history.length > 0,
      )

      setError(
        hasCachedHistory
          ? fetchError?.name === 'RequestTimeoutError'
            ? 'La consulta tardó demasiado. Mostrando el último histórico guardado.'
            : 'Sin conexión. Mostrando el último histórico guardado.'
          : getFetchErrorMessage(
              fetchError,
              'No se pudo consultar el histórico. Verifica tu conexión.',
            ),
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

      didFetchRef.current = false
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
