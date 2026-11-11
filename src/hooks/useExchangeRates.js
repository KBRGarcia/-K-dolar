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

const CARACAS_TIME_ZONE = 'America/Caracas'

// Sábado y domingo el BCV no publica: se usa la tasa del lunes siguiente,
// que el BCV ya anunció el viernes y la API expone en el histórico.
function getWeekendTargetMonday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type)?.value
  const daysUntilMonday = { Sat: 2, Sun: 1 }[get('weekday')]

  if (!daysUntilMonday) return null

  const monday = new Date(
    Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))),
  )

  monday.setUTCDate(monday.getUTCDate() + daysUntilMonday)

  return monday.toISOString().slice(0, 10)
}

async function fetchWeekendOfficialRate(option, signal) {
  const targetDate = getWeekendTargetMonday()

  if (!targetDate || option.source !== 'oficial' || !option.historyEndpoint) return null

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${option.historyEndpoint}`, {
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) return null

    const history = await response.json()
    const entry = Array.isArray(history)
      ? history.find((item) => item.fecha === targetDate)
      : null

    return entry ? { rate: getNumericRate(entry), date: targetDate } : null
  } catch (error) {
    if (error?.name === 'AbortError') throw error

    return null
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

          const normalized = normalizeRate(await response.json(), option)
          const weekendRate = await fetchWeekendOfficialRate(option, controller.signal)

          if (weekendRate && Number.isFinite(weekendRate.rate)) {
            normalized.average = weekendRate.rate
            normalized.effectiveDate = weekendRate.date
          }

          return normalized
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
