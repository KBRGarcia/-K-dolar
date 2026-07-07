import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEFAULT_RATE_ID, RATE_OPTIONS } from '../constants/rates'

const valueFormatter = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'VES',
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'medium',
})

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateValue

  return dateFormatter.format(date)
}

function getTrend(item) {
  if (item.change > 0) {
    return {
      className: 'text-emerald-300',
      icon: ArrowUp,
    }
  }

  if (item.change < 0) {
    return {
      className: 'text-red-300',
      icon: ArrowDown,
    }
  }

  return {
    className: 'text-slate-300',
    icon: ArrowRight,
  }
}

function HistoryTable({ historyById, loading }) {
  const [selectedRateId, setSelectedRateId] = useState(DEFAULT_RATE_ID)
  const selectedRate = RATE_OPTIONS.find((rate) => rate.id === selectedRateId)

  const rows = useMemo(() => {
    return [...(historyById[selectedRateId] ?? [])].reverse().slice(0, 60)
  }, [historyById, selectedRateId])

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
            Tabla
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Histórico por fecha
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Revisa los últimos registros y su variación contra el día anterior.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Filtrar moneda
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-slate-950/50 p-2">
            {RATE_OPTIONS.map((option) => {
              const isSelected = selectedRateId === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedRateId(option.id)}
                  className={`rounded-2xl px-2 py-3 text-center text-xs font-bold leading-tight transition sm:text-sm ${
                    isSelected
                      ? 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-pressed={isSelected}
                >
                  {option.title}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Fecha</th>
                <th className="px-4 py-4">{selectedRate?.title}</th>
                <th className="px-4 py-4">Variación</th>
                <th className="px-4 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/50 text-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-300" colSpan="4">
                    Cargando histórico...
                  </td>
                </tr>
              ) : (
                rows.map((item) => {
                  const trend = getTrend(item)
                  const TrendIcon = trend.icon

                  return (
                    <tr key={`${selectedRateId}-${item.date}`}>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold">
                        {formatDate(item.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {valueFormatter.format(item.value)}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 ${trend.className}`}>
                        {valueFormatter.format(item.change)} (
                        {percentFormatter.format(item.changePercent)}%)
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 ${trend.className}`}>
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <TrendIcon className="h-4 w-4" aria-hidden="true" />
                          {trend.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default HistoryTable
