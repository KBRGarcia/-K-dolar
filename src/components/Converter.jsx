import { ArrowDownUp, Check, Copy, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const MAX_DIGITS = 15

const rateFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function digitsToAmount(digits) {
  const cents = Number(String(digits || '0').replace(/\D/g, '') || '0')

  if (!Number.isFinite(cents)) return 0

  return cents / 100
}

function amountToDigits(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return '0'

  const [integerPart, decimalPart] = amount.toFixed(2).split('.')
  const digits = `${integerPart}${decimalPart}`.replace(/^0+(?=\d)/, '')

  return digits || '0'
}

function formatDisplay(digits) {
  const [integerPart, decimalPart] = digitsToAmount(digits).toFixed(2).split('.')
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${withThousands},${decimalPart}`
}

function formatClipboard(digits) {
  const [integerPart, decimalPart] = digitsToAmount(digits).toFixed(2).split('.')

  return `${integerPart},${decimalPart}`
}

function getConvertedAmount(amount, currency, exchangeRate) {
  if (!Number.isFinite(amount) || !Number.isFinite(exchangeRate) || exchangeRate === 0) {
    return null
  }

  return currency === 'VES' ? amount / exchangeRate : amount * exchangeRate
}

function getForeignCurrencyMeta(rate) {
  if (rate?.id === 'dolar-paralelo') {
    return { code: 'USDT', label: 'USDT' }
  }

  if (rate?.currency === 'EUR') {
    return { code: 'EUR', label: 'Euros' }
  }

  return { code: 'USD', label: 'Dólares' }
}

function CurrencyInput({
  currency,
  label,
  digits,
  onDigitsChange,
  onClear,
  disabled,
}) {
  const inputRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const displayValue = formatDisplay(digits)

  useEffect(() => {
    if (!copied) return undefined

    const timeoutId = window.setTimeout(() => setCopied(false), 1500)

    return () => window.clearTimeout(timeoutId)
  }, [copied])

  const placeCaretAtEnd = () => {
    const input = inputRef.current

    if (!input) return

    const length = displayValue.length
    input.setSelectionRange(length, length)
  }

  useLayoutEffect(() => {
    const input = inputRef.current

    if (!input) return

    const length = displayValue.length
    input.setSelectionRange(length, length)
  }, [displayValue])

  const handleKeyDown = (event) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return

    const input = inputRef.current

    if (!input) return

    const { selectionStart, selectionEnd } = input
    const atEnd =
      selectionStart === displayValue.length && selectionEnd === displayValue.length

    if (!atEnd) return

    event.preventDefault()

    const nextDigits = digits.length <= 1 ? '0' : digits.slice(0, -1)

    onDigitsChange(nextDigits)
  }

  const handleChange = (event) => {
    const nextDigits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS) || '0'

    if (nextDigits !== digits) {
      onDigitsChange(nextDigits)
      return
    }

    placeCaretAtEnd()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatClipboard(digits))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="block rounded-3xl border border-white/10 bg-slate-950/60 p-4">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-300">
        <span>{label}</span>
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={disabled}
            className="inline-flex items-center justify-center text-sky-200 transition hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={copied ? 'Monto copiado' : 'Copiar monto'}
            title={copied ? 'Copiado' : 'Copiar monto'}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-sky-200">
            {currency}
          </span>
        </span>
      </span>

      <span className="relative mt-4 block">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={placeCaretAtEnd}
          onFocus={placeCaretAtEnd}
          disabled={disabled}
          className="w-full bg-transparent pr-10 text-4xl font-bold tracking-tight text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={label}
        />

        <button
          type="button"
          onClick={onClear}
          disabled={disabled || digits === '0'}
          className="absolute right-0 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Limpiar ${label}`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

function Converter({ rate, loading }) {
  const { code: foreignCode, label: foreignLabel } = getForeignCurrencyMeta(rate)
  const [vesOnTop, setVesOnTop] = useState(false)
  const [topDigits, setTopDigits] = useState('0')
  const [bottomDigits, setBottomDigits] = useState('0')
  const topDigitsRef = useRef(topDigits)
  const bottomDigitsRef = useRef(bottomDigits)
  const vesOnTopRef = useRef(vesOnTop)
  const lastEditedCurrencyRef = useRef('foreign')

  const exchangeRate = rate?.average
  const topCurrency = vesOnTop ? 'VES' : foreignCode
  const bottomCurrency = vesOnTop ? foreignCode : 'VES'
  const disabled = loading || !Number.isFinite(exchangeRate)

  useEffect(() => {
    topDigitsRef.current = topDigits
    bottomDigitsRef.current = bottomDigits
    vesOnTopRef.current = vesOnTop
  })

  const conversionHint = useMemo(() => {
    if (!Number.isFinite(exchangeRate)) {
      return 'Esperando una cotización válida para convertir.'
    }

    return `1 ${foreignCode} = ${rateFormatter.format(exchangeRate)} VES`
  }, [foreignCode, exchangeRate])

  useEffect(() => {
    const isLastEditedVes = lastEditedCurrencyRef.current === 'VES'
    const sourceDigits = isLastEditedVes
      ? vesOnTopRef.current
        ? topDigitsRef.current
        : bottomDigitsRef.current
      : vesOnTopRef.current
        ? bottomDigitsRef.current
        : topDigitsRef.current
    const convertedAmount = getConvertedAmount(
      digitsToAmount(sourceDigits),
      isLastEditedVes ? 'VES' : foreignCode,
      exchangeRate,
    )
    const convertedDigits =
      convertedAmount === null ? '0' : amountToDigits(convertedAmount)

    if (vesOnTopRef.current) {
      setTopDigits(isLastEditedVes ? sourceDigits : convertedDigits)
      setBottomDigits(isLastEditedVes ? convertedDigits : sourceDigits)
      return
    }

    setTopDigits(isLastEditedVes ? convertedDigits : sourceDigits)
    setBottomDigits(isLastEditedVes ? sourceDigits : convertedDigits)
  }, [foreignCode, rate?.id, exchangeRate])

  const updatePair = (digits, sourceCurrency, sourcePosition) => {
    lastEditedCurrencyRef.current = sourceCurrency === 'VES' ? 'VES' : 'foreign'

    const amount = digitsToAmount(digits)
    const convertedAmount = getConvertedAmount(amount, sourceCurrency, exchangeRate)
    const convertedDigits =
      convertedAmount === null ? '0' : amountToDigits(convertedAmount)

    if (sourcePosition === 'top') {
      setTopDigits(digits)
      setBottomDigits(convertedDigits)
      return
    }

    setBottomDigits(digits)
    setTopDigits(convertedDigits)
  }

  const clearPair = () => {
    setTopDigits('0')
    setBottomDigits('0')
  }

  const handleSwap = () => {
    setVesOnTop((current) => !current)
    setTopDigits(bottomDigits)
    setBottomDigits(topDigits)
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
          currency={topCurrency}
          label={topCurrency === 'VES' ? 'Bolívares' : foreignLabel}
          digits={topDigits}
          onDigitsChange={(digits) => updatePair(digits, topCurrency, 'top')}
          onClear={clearPair}
          disabled={disabled}
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            disabled={disabled}
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Invertir monedas"
          >
            <ArrowDownUp className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <CurrencyInput
          currency={bottomCurrency}
          label={bottomCurrency === 'VES' ? 'Bolívares' : foreignLabel}
          digits={bottomDigits}
          onDigitsChange={(digits) =>
            updatePair(digits, bottomCurrency, 'bottom')
          }
          onClear={clearPair}
          disabled={disabled}
        />
      </div>
    </section>
  )
}

export default Converter
