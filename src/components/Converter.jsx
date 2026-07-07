import { ArrowDownUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const usdFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
})

const vesFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
})

function parseAmount(value) {
  const sanitizedValue = value.trim().replace(/\s/g, '')

  if (!sanitizedValue) return null

  const lastComma = sanitizedValue.lastIndexOf(',')
  const lastDot = sanitizedValue.lastIndexOf('.')
  const hasThousandsDots = /^\d{1,3}(\.\d{3})+$/.test(sanitizedValue)
  let normalizedValue = sanitizedValue

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','

    normalizedValue = sanitizedValue
      .replaceAll(thousandsSeparator, '')
      .replace(decimalSeparator, '.')
  } else if (lastComma > -1) {
    normalizedValue = sanitizedValue.replace(/\./g, '').replace(',', '.')
  } else if (hasThousandsDots) {
    normalizedValue = sanitizedValue.replace(/\./g, '')
  }

  const amount = Number(normalizedValue)

  return Number.isFinite(amount) ? amount : null
}

function formatInputValue(amount, currency) {
  if (!Number.isFinite(amount)) return ''

  const formatter = currency === 'USD' ? usdFormatter : vesFormatter

  return formatter.format(amount)
}

function getConvertedAmount(amount, currency, exchangeRate) {
  if (!Number.isFinite(amount) || !Number.isFinite(exchangeRate)) return null

  return currency === 'USD' ? amount * exchangeRate : amount / exchangeRate
}

function CurrencyInput({ currency, label, value, onChange, disabled }) {
  return (
    <label className="block rounded-3xl border border-white/10 bg-slate-950/60 p-4">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-300">
        <span>{label}</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-sky-200">
          {currency}
        </span>
      </span>

      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="0,00"
        className="mt-4 w-full bg-transparent text-4xl font-bold tracking-tight text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  )
}

function Converter({ rate, loading }) {
  const baseCurrency = rate?.currency ?? 'USD'
  const baseLabel = rate?.currency === 'EUR' ? 'Euros' : 'Dólares'
  const [topCurrency, setTopCurrency] = useState(baseCurrency)
  const [topValue, setTopValue] = useState('')
  const [bottomValue, setBottomValue] = useState('')

  const exchangeRate = rate?.average
  const normalizedTopCurrency = topCurrency === 'VES' ? 'VES' : baseCurrency
  const bottomCurrency = normalizedTopCurrency === 'VES' ? baseCurrency : 'VES'
  const disabled = loading || !Number.isFinite(exchangeRate)

  const conversionHint = useMemo(() => {
    if (!Number.isFinite(exchangeRate)) {
      return 'Esperando una cotización válida para convertir.'
    }

    return `1 ${baseCurrency} = ${vesFormatter.format(exchangeRate)} VES`
  }, [baseCurrency, exchangeRate])

  useEffect(() => {
    setTopCurrency(baseCurrency)
    setTopValue('')
    setBottomValue('')
  }, [baseCurrency, rate?.id])

  const updatePair = (value, sourceCurrency, sourcePosition) => {
    const amount = parseAmount(value)
    const convertedAmount = getConvertedAmount(amount, sourceCurrency, exchangeRate)
    const formattedConvertedValue =
      convertedAmount === null
        ? ''
        : formatInputValue(
            convertedAmount,
            sourceCurrency === 'USD' ? 'VES' : 'USD',
          )

    if (sourcePosition === 'top') {
      setTopValue(value)
      setBottomValue(formattedConvertedValue)
      return
    }

    setBottomValue(value)
    setTopValue(formattedConvertedValue)
  }

  const handleSwap = () => {
    setTopCurrency(bottomCurrency)
    setTopValue(bottomValue)
    setBottomValue(topValue)
  }

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
          Calculadora
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Conversión instantánea
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{conversionHint}</p>
      </div>

      <div className="space-y-4">
        <CurrencyInput
          currency={normalizedTopCurrency}
          label={normalizedTopCurrency === 'VES' ? 'Bolívares' : baseLabel}
          value={topValue}
          onChange={(value) => updatePair(value, normalizedTopCurrency, 'top')}
          disabled={disabled}
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 hover:bg-sky-300"
            aria-label="Invertir monedas"
          >
            <ArrowDownUp className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <CurrencyInput
          currency={bottomCurrency}
          label={bottomCurrency === 'VES' ? 'Bolívares' : baseLabel}
          value={bottomValue}
          onChange={(value) => updatePair(value, bottomCurrency, 'bottom')}
          disabled={disabled}
        />
      </div>
    </section>
  )
}

export default Converter
