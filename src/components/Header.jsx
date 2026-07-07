import { RefreshCw } from 'lucide-react'
import { RATE_OPTIONS } from '../constants/rates'

const currencyFormatter = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'VES',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatRate(rate) {
  if (!Number.isFinite(rate)) return 'No disponible'

  return currencyFormatter.format(rate)
}

function formatUpdatedAt(updatedAt) {
  if (!updatedAt) return 'Pendiente de actualización'

  const date = new Date(updatedAt)

  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return dateFormatter.format(date)
}

function Header({
  ratesById,
  selectedRateId,
  updatedAt,
  loading,
  onRefresh,
  onSelectRate,
}) {
  const selectedRate = ratesById[selectedRateId]
  const currentRate = selectedRate?.average
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`

  return (
    <header className="rounded-4xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-sky-300/20 bg-sky-300/10 py-1 pl-1 pr-4 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
            <img
              src={logoUrl}
              alt="Logo $K Dolar"
              className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20"
            />
            $K Dolar
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Conversor de Bs.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Calcula al instante usando la cotización oficial o paralela
            disponible en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Actualizar
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {selectedRate?.title ?? 'Cotización seleccionada'}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {loading ? 'Consultando...' : formatRate(currentRate)}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Última actualización
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {loading ? 'Sincronizando datos' : formatUpdatedAt(updatedAt)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {RATE_OPTIONS.map((option) => {
          const rate = ratesById[option.id]
          const isSelected = selectedRateId === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectRate(option.id)}
              className={`rounded-2xl border p-4 text-center transition ${
                isSelected
                  ? 'border-sky-300 bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/25'
                  : 'border-white/10 bg-slate-900/70 text-white hover:border-sky-300/50 hover:bg-slate-800'
              }`}
            >
              <span className="block text-sm font-bold sm:text-base">
                {option.title}
              </span>
              <span className="mt-2 block text-xl font-black">
                {loading ? option.symbol : formatRate(rate?.average)}
              </span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

export default Header
