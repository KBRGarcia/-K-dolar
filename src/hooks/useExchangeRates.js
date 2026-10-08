import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL, DEFAULT_RATE_ID, RATE_OPTIONS } from '../constants/rates'
import { readCache, writeCache } from '../utils/cacheStorage'
import { fetchWithTimeout, getFetchErrorMessage } from '../utils/fetchWithTimeout'
import { roundRate } from '../utils/rateFormat'

const EXCHANGE_RATES_CACHE_KEY = 'k-dolar:exchange-rates'

function getNumericRate(rate) {
  return roundRate(rate.promedio ?? rate.venta ?? rate.compra)
}

function normalizeRate(rate, option) {
  return {
    ...option,
    name: rate.nombre,
    buy: Number(rate.compra),
    sell: Number(rate.venta),
    average: getNumericRate(rate),
    updatedAt: rate.fechaActualizacion,
  }
}

function getLatestUpdate(rates) {
  return rates.reduce((latestDate, rate) => {
    if (!rate.updatedAt) return latestDate

    const currentDate = new Date(rate.updatedAt)

    if (Number.isNaN(currentDate.getTime())) return latestDate
    if (!latestDate || currentDate > latestDate) return currentDate

    return latestDate
  }, null)
}

export function useExchangeRates() {
  const cachedRates = readCache(EXCHANGE_RATES_CACHE_KEY, [])
  const [rates, setRates] = useState(cachedRates)
  const [loading, setLoading] = useState(cachedRates.length === 0)
  const [error, setError] = useState(null)
  const [isUsingCache, setIsUsingCache] = useState(cachedRates.length > 0)
  const abortControllerRef = useRef(null)
  const ratesRef = useRef(cachedRates)

  const fetchRates = useCallback(async () => {
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const results = await Promise.allSettled(
        RATE_OPTIONS.map(async (option) => {
          const response = await fetchWithTimeout(`${API_BASE_URL}${option.endpoint}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })

          if (!response.ok) {
            throw new Error(`No se pudo consultar ${option.title}.`)
          }

          return normalizeRate(await response.json(), option)
        }),
      )
      const responses = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
      const failedOptions = RATE_OPTIONS.filter(
        (_, index) => results[index].status === 'rejected',
      )

      if (responses.length === 0) {
        throw results.find((result) => result.status === 'rejected')?.reason
      }

      const previousRatesById = ratesRef.current.reduce((accumulator, rate) => {
        accumulator[rate.id] = rate
        return accumulator
      }, {})
      const responsesById = responses.reduce((accumulator, rate) => {
        accumulator[rate.id] = rate
        return accumulator
      }, {})
      const mergedRates = RATE_OPTIONS.map((option) => {
        return responsesById[option.id] ?? previousRatesById[option.id]
      }).filter(Boolean)

      setRates(mergedRates)
      ratesRef.current = mergedRates
      writeCache(EXCHANGE_RATES_CACHE_KEY, mergedRates)
      setIsUsingCache(failedOptions.length > 0 && mergedRates.length > responses.length)
      setError(
        failedOptions.length > 0
          ? `No se pudo actualizar ${failedOptions
              .map((option) => option.title)
              .join(', ')}. Mostrando el último valor disponible.`
          : null,
      )
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') return

      setError(
        ratesRef.current.length > 0
          ? fetchError?.name === 'RequestTimeoutError'
            ? 'La consulta tardó demasiado. Mostrando la última cotización guardada.'
            : 'Sin conexión. Mostrando la última cotización guardada.'
          : getFetchErrorMessage(
              fetchError,
              'No se pudieron consultar las cotizaciones. Verifica tu conexión.',
            ),
      )
      setIsUsingCache(ratesRef.current.length > 0)
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
        abortControllerRef.current = null
      }
    }
  }, [])

  const latestUpdatedAt = useMemo(() => {
    return getLatestUpdate(rates)?.toISOString() ?? null
  }, [rates])

  const ratesById = useMemo(() => {
    return rates.reduce((accumulator, rate) => {
      accumulator[rate.id] = rate
      return accumulator
    }, {})
  }, [rates])

  const defaultRate = ratesById[DEFAULT_RATE_ID] ?? rates[0] ?? null

  useEffect(() => {
    fetchRates()

    return () => {
      const controller = abortControllerRef.current

      abortControllerRef.current = null
      controller?.abort()
    }
  }, [fetchRates])

  useEffect(() => {
    const handleOnline = () => {
      fetchRates()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchRates])

  return {
    rates,
    ratesById,
    defaultRate,
    updatedAt: latestUpdatedAt,
    loading,
    error,
    isUsingCache,
    refresh: fetchRates,
  }
}

export default useExchangeRates
