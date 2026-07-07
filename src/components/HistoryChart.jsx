import { useMemo, useState } from 'react'
import { RATE_OPTIONS } from '../constants/rates'

const valueFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
})

const CHART_LIMIT = 90
const VIEW_BOX = {
  width: 720,
  height: 260,
  padding: 28,
}

function getChartPoints(history, minValue, maxValue) {
  const visibleHistory = history.slice(-CHART_LIMIT)
  const range = maxValue - minValue || 1
  const chartWidth = VIEW_BOX.width - VIEW_BOX.padding * 2
  const chartHeight = VIEW_BOX.height - VIEW_BOX.padding * 2

  return visibleHistory.map((item, index) => {
    const x =
      VIEW_BOX.padding +
      (visibleHistory.length === 1
        ? chartWidth / 2
        : (index / (visibleHistory.length - 1)) * chartWidth)
    const y =
      VIEW_BOX.padding +
      chartHeight -
      ((item.value - minValue) / range) * chartHeight

    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
}

function HistoryChart({ historyById, loading, error, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState(RATE_OPTIONS.map((rate) => rate.id))

  const selectedSeries = useMemo(() => {
    return RATE_OPTIONS.map((option) => ({
      ...option,
      history: historyById[option.id] ?? [],
    })).filter((serie) => selectedIds.includes(serie.id) && serie.history.length > 0)
  }, [historyById, selectedIds])

  const valueRange = useMemo(() => {
    const values = selectedSeries.flatMap((serie) =>
      serie.history.slice(-CHART_LIMIT).map((item) => item.value),
    )

    if (values.length === 0) return { min: 0, max: 1 }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }, [selectedSeries])

  const toggleRate = (rateId) => {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(rateId)) {
        return currentIds.length === 1
          ? currentIds
          : currentIds.filter((id) => id !== rateId)
      }

      return [...currentIds, rateId]
    })
  }

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
            Histórico
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Evolución de cotizaciones
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Selecciona una o varias monedas para compararlas en la gráfica.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Consultando...' : 'Actualizar histórico'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {RATE_OPTIONS.map((option) => {
          const isSelected = selectedIds.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleRate(option.id)}
              className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                isSelected
                  ? 'border-sky-300 bg-sky-400 text-slate-950'
                  : 'border-white/10 bg-slate-900/70 text-slate-200 hover:border-sky-300/50'
              }`}
            >
              {option.title}
            </button>
          )
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        {error && (
          <p className="mb-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {loading && selectedSeries.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-slate-300">
            Cargando gráfico histórico...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
            role="img"
            aria-label="Gráfica histórica de monedas"
            className="h-72 w-full"
          >
            <line
              x1={VIEW_BOX.padding}
              x2={VIEW_BOX.width - VIEW_BOX.padding}
              y1={VIEW_BOX.height - VIEW_BOX.padding}
              y2={VIEW_BOX.height - VIEW_BOX.padding}
              stroke="rgba(255,255,255,0.18)"
            />
            <line
              x1={VIEW_BOX.padding}
              x2={VIEW_BOX.padding}
              y1={VIEW_BOX.padding}
              y2={VIEW_BOX.height - VIEW_BOX.padding}
              stroke="rgba(255,255,255,0.18)"
            />
            {selectedSeries.map((serie) => (
              <polyline
                key={serie.id}
                fill="none"
                stroke={serie.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
                points={getChartPoints(serie.history, valueRange.min, valueRange.max).join(
                  ' ',
                )}
              />
            ))}
            <text x="36" y="22" fill="rgba(255,255,255,0.65)" fontSize="18">
              {valueFormatter.format(valueRange.max)} Bs.
            </text>
            <text
              x="36"
              y={VIEW_BOX.height - 8}
              fill="rgba(255,255,255,0.65)"
              fontSize="18"
            >
              {valueFormatter.format(valueRange.min)} Bs.
            </text>
          </svg>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {RATE_OPTIONS.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: option.color }}
            />
            {option.title}
          </span>
        ))}
      </div>
    </section>
  )
}

export default HistoryChart
