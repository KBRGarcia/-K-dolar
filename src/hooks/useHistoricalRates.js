import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, RATE_OPTIONS } from '../constants/rates'

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
  const [historyById, setHistoryById] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

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

      setHistoryById(Object.fromEntries(histories))
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') return

      setError(
        fetchError.message ||
          'No se pudo consultar el histórico. Verifica tu conexión.',
      )
      setHistoryById({})
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
    if (!enabled || hasHistory) return undefined

    fetchHistory()

    return () => {
      const controller = abortControllerRef.current

      abortControllerRef.current = null
      controller?.abort()
    }
  }, [enabled, fetchHistory, hasHistory])

  return {
    historyById,
    loading,
    error,
    refresh: fetchHistory,
  }
}

export default useHistoricalRates
