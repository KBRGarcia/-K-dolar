import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RATE_OPTIONS } from '../constants/rates'
import { formatVesDecimal } from '../utils/rateFormat'

const CHART_LIMIT = 90
const DAY_MS = 24 * 60 * 60 * 1000
const MIN_ZOOM_SPAN = 7 * DAY_MS
const INLINE_DIMS = { width: 720, height: 260, padding: 28, font: 13, smallFont: 12 }
const TAP_THRESHOLD = 6

function parseHistoryTime(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateValue ?? ''))

  if (!match) return null

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatAxisDateFromTime(time) {
  const date = new Date(time)

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`
}

function formatFullDate(time) {
  const date = new Date(time)

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function getVisibleHistory(history) {
  return history.slice(-CHART_LIMIT).flatMap((item) => {
    const time = parseHistoryTime(item.date)

    return time === null ? [] : [{ ...item, time }]
  })
}

function getTimeDomain(series) {
  const times = series.flatMap((serie) =>
    getVisibleHistory(serie.history).map((item) => item.time),
  )

  if (times.length === 0) return null

  return {
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
  }
}

function getX(time, domain, dims) {
  const chartWidth = dims.width - dims.padding * 2

  if (!domain || domain.maxTime === domain.minTime) {
    return dims.padding + chartWidth / 2
  }

  return (
    dims.padding +
    ((time - domain.minTime) / (domain.maxTime - domain.minTime)) * chartWidth
  )
}

function getChartCoordinates(history, minValue, maxValue, domain, dims) {
  const range = maxValue - minValue || 1
  const chartHeight = dims.height - dims.padding * 2

  return getVisibleHistory(history).map((item) => ({
    x: getX(item.time, domain, dims),
    y: dims.padding + chartHeight - ((item.value - minValue) / range) * chartHeight,
    item,
  }))
}

function getHorizontalGuides(minValue, maxValue, dims) {
  const guideCount = 4
  const range = maxValue - minValue || 1

  return Array.from({ length: guideCount }, (_, index) => {
    const ratio = index / (guideCount - 1)

    return {
      y: dims.padding + ratio * (dims.height - dims.padding * 2),
      value: maxValue - range * ratio,
    }
  })
}

function getVerticalGuides(domain, dims) {
  if (!domain) return []

  const guideCount = domain.maxTime === domain.minTime ? 1 : 5

  return Array.from({ length: guideCount }, (_, index) => {
    const ratio = guideCount === 1 ? 0.5 : index / (guideCount - 1)
    const rawTime = domain.minTime + ratio * (domain.maxTime - domain.minTime)
    const snapped = new Date(rawTime)

    if (snapped.getHours() >= 12) snapped.setDate(snapped.getDate() + 1)
    snapped.setHours(0, 0, 0, 0)

    return {
      x: getX(snapped.getTime(), domain, dims),
      label: formatAxisDateFromTime(snapped.getTime()),
    }
  })
}

function clampView(view, fullDomain) {
  const fullSpan = fullDomain.maxTime - fullDomain.minTime
  const minSpan = Math.min(MIN_ZOOM_SPAN, fullSpan)
  const span = Math.min(Math.max(view.maxTime - view.minTime, minSpan), fullSpan)
  const minTime = Math.min(
    Math.max(view.minTime, fullDomain.minTime),
    fullDomain.maxTime - span,
  )

  return { minTime, maxTime: minTime + span }
}

function ChartCanvas({
  series,
  dims,
  fullDomain,
  view,
  onViewChange,
  interactive = false,
  rotated = false,
}) {
  const svgRef = useRef(null)
  const pointersRef = useRef(new Map())
  const gestureRef = useRef(null)
  const [cursorTime, setCursorTime] = useState(null)
  const domain = view ?? fullDomain

  const valueRange = useMemo(() => {
    const allItems = series.flatMap((serie) => getVisibleHistory(serie.history))
    const inView = allItems.filter(
      (item) => item.time >= domain.minTime && item.time <= domain.maxTime,
    )
    const values = (inView.length > 0 ? inView : allItems).map((item) => item.value)

    if (values.length === 0) return { min: 0, max: 1 }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const margin = interactive ? (max - min || 1) * 0.08 : 0

    return { min: min - margin, max: max + margin }
  }, [series, domain, interactive])

  const horizontalGuides = useMemo(
    () => getHorizontalGuides(valueRange.min, valueRange.max, dims),
    [valueRange, dims],
  )
  const verticalGuides = useMemo(() => getVerticalGuides(domain, dims), [domain, dims])
  const plotWidth = dims.width - dims.padding * 2
  const clipId = `clip-${interactive ? 'full' : 'inline'}`

  const getLocalX = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()

    return rotated ? clientY - rect.top : clientX - rect.left
  }

  const timeAtLocalX = (localX) => {
    const ratio = (localX - dims.padding) / plotWidth

    return domain.minTime + ratio * (domain.maxTime - domain.minTime)
  }

  const zoomAround = (anchorTime, factor) => {
    const anchorRatio =
      (anchorTime - domain.minTime) / (domain.maxTime - domain.minTime || 1)
    const nextSpan = (domain.maxTime - domain.minTime) * factor
    const minTime = anchorTime - anchorRatio * nextSpan

    onViewChange(clampView({ minTime, maxTime: minTime + nextSpan }, fullDomain))
  }

  const handlePointerDown = (event) => {
    if (!interactive) return

    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gestureRef.current = { moved: 0 }
  }

  const handlePointerMove = (event) => {
    if (!interactive) return

    const pointers = pointersRef.current
    const previous = pointers.get(event.pointerId)

    if (!previous) return

    const current = { x: event.clientX, y: event.clientY }
    const otherPointer = [...pointers.entries()].find(([id]) => id !== event.pointerId)

    if (otherPointer) {
      const other = otherPointer[1]
      const prevDistance = Math.hypot(previous.x - other.x, previous.y - other.y)
      const distance = Math.hypot(current.x - other.x, current.y - other.y)

      gestureRef.current.moved += TAP_THRESHOLD

      if (prevDistance > 0 && distance > 0) {
        const centerX = getLocalX((current.x + other.x) / 2, (current.y + other.y) / 2)

        zoomAround(timeAtLocalX(centerX), prevDistance / distance)
      }
    } else {
      const delta = rotated ? current.y - previous.y : current.x - previous.x

      gestureRef.current.moved += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)

      if (view && gestureRef.current.moved > TAP_THRESHOLD) {
        const shift = (-delta / plotWidth) * (domain.maxTime - domain.minTime)

        onViewChange(
          clampView(
            { minTime: domain.minTime + shift, maxTime: domain.maxTime + shift },
            fullDomain,
          ),
        )
      }
    }

    pointers.set(event.pointerId, current)
  }

  const handlePointerUp = (event) => {
    if (!interactive) return

    const wasTap =
      pointersRef.current.size === 1 && gestureRef.current?.moved <= TAP_THRESHOLD

    pointersRef.current.delete(event.pointerId)

    if (wasTap) {
      setCursorTime(timeAtLocalX(getLocalX(event.clientX, event.clientY)))
    }
  }

  useEffect(() => {
    const svg = svgRef.current

    if (!interactive || !svg) return undefined

    const handleWheel = (event) => {
      event.preventDefault()

      const rect = svg.getBoundingClientRect()
      const localX = rotated ? event.clientY - rect.top : event.clientX - rect.left
      const ratio = (localX - dims.padding) / plotWidth
      const anchorTime = domain.minTime + ratio * (domain.maxTime - domain.minTime)
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15
      const nextSpan = (domain.maxTime - domain.minTime) * factor
      const minTime = anchorTime - ratio * nextSpan

      onViewChange(clampView({ minTime, maxTime: minTime + nextSpan }, fullDomain))
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })

    return () => svg.removeEventListener('wheel', handleWheel)
  }, [interactive, rotated, dims, plotWidth, domain, fullDomain, onViewChange])

  const cursorInfo = useMemo(() => {
    if (cursorTime === null) return null

    const points = series.flatMap((serie) => {
      const items = getVisibleHistory(serie.history)

      if (items.length === 0) return []

      const nearest = items.reduce((best, item) =>
        Math.abs(item.time - cursorTime) < Math.abs(best.time - cursorTime) ? item : best,
      )

      return [{ serie, item: nearest }]
    })

    if (points.length === 0) return null

    const time = points[0].item.time

    if (time < domain.minTime || time > domain.maxTime) return null

    return { time, points }
  }, [cursorTime, series, domain])

  const font = dims.font
  const smallFont = dims.smallFont
  const cursorX = cursorInfo ? getX(cursorInfo.time, domain, dims) : 0
  const boxWidth = 150
  const boxHeight = 16 + (cursorInfo?.points.length ?? 0) * 16
  const boxX = cursorX > dims.width / 2 ? cursorX - boxWidth - 10 : cursorX + 10

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      role="img"
      aria-label="Gráfica histórica de monedas"
      className={interactive ? 'h-full w-full select-none' : 'h-72 w-full'}
      style={interactive ? { touchAction: 'none' } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={dims.padding}
            y={0}
            width={plotWidth}
            height={dims.height}
          />
        </clipPath>
      </defs>
      {horizontalGuides.map((guide) => (
        <g key={`h-${guide.y}`}>
          <line
            x1={dims.padding}
            x2={dims.width - dims.padding}
            y1={guide.y}
            y2={guide.y}
            stroke="rgba(255,255,255,0.10)"
            strokeDasharray="6 8"
          />
          <text
            x={dims.padding + 6}
            y={guide.y - 6}
            fill="rgba(255,255,255,0.50)"
            fontSize={font}
          >
            {formatVesDecimal(guide.value)}
          </text>
        </g>
      ))}
      {verticalGuides.map((guide) => (
        <g key={`v-${guide.x}`}>
          <line
            x1={guide.x}
            x2={guide.x}
            y1={dims.padding}
            y2={dims.height - dims.padding}
            stroke="rgba(255,255,255,0.07)"
          />
          <text
            x={guide.x}
            y={dims.height - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.42)"
            fontSize={smallFont}
          >
            {guide.label}
          </text>
        </g>
      ))}
      <line
        x1={dims.padding}
        x2={dims.width - dims.padding}
        y1={dims.height - dims.padding}
        y2={dims.height - dims.padding}
        stroke="rgba(255,255,255,0.18)"
      />
      <line
        x1={dims.padding}
        x2={dims.padding}
        y1={dims.padding}
        y2={dims.height - dims.padding}
        stroke="rgba(255,255,255,0.18)"
      />
      <g clipPath={`url(#${clipId})`}>
        {series.map((serie) => {
          const coordinates = getChartCoordinates(
            serie.history,
            valueRange.min,
            valueRange.max,
            domain,
            dims,
          )

          return (
            <polyline
              key={serie.id}
              fill="none"
              stroke={serie.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={interactive ? 3 : 4}
              points={coordinates
                .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
                .join(' ')}
            />
          )
        })}
      </g>
      {series.map((serie) => {
        const coordinates = getChartCoordinates(
          serie.history,
          valueRange.min,
          valueRange.max,
          domain,
          dims,
        )
        const latestPoint = coordinates.at(-1)

        if (!latestPoint || latestPoint.x > dims.width - dims.padding + 1) return null

        return (
          <g key={serie.id}>
            <circle
              cx={latestPoint.x}
              cy={latestPoint.y}
              r="5"
              fill={serie.color}
              stroke="#0f172a"
              strokeWidth="3"
            />
            <text
              x={Math.min(latestPoint.x + 10, dims.width - 92)}
              y={Math.max(latestPoint.y - 10, 16)}
              fill={serie.color}
              fontSize={font}
              fontWeight="700"
            >
              {formatVesDecimal(latestPoint.item.value)}
            </text>
          </g>
        )
      })}
      {cursorInfo && (
        <g pointerEvents="none">
          <line
            x1={cursorX}
            x2={cursorX}
            y1={dims.padding}
            y2={dims.height - dims.padding}
            stroke="rgba(255,255,255,0.45)"
            strokeDasharray="4 4"
          />
          {cursorInfo.points.map(({ serie, item }) => {
            const [point] = getChartCoordinates(
              [item],
              valueRange.min,
              valueRange.max,
              domain,
              dims,
            ).map((coordinate) => coordinate)
            const y = point
              ? point.y
              : dims.height / 2

            return (
              <circle
                key={serie.id}
                cx={cursorX}
                cy={y}
                r="5"
                fill={serie.color}
                stroke="#0f172a"
                strokeWidth="2"
              />
            )
          })}
          <rect
            x={boxX}
            y={dims.padding}
            width={boxWidth}
            height={boxHeight}
            rx="8"
            fill="rgba(15,23,42,0.92)"
            stroke="rgba(255,255,255,0.18)"
          />
          <text x={boxX + 10} y={dims.padding + 14} fill="#e2e8f0" fontSize={smallFont} fontWeight="700">
            {formatFullDate(cursorInfo.time)}
          </text>
          {cursorInfo.points.map(({ serie, item }, index) => (
            <text
              key={serie.id}
              x={boxX + 10}
              y={dims.padding + 30 + index * 16}
              fill={serie.color}
              fontSize={smallFont}
              fontWeight="700"
            >
              {serie.shortTitle}: {formatVesDecimal(item.value)}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}

function FullscreenChart({ series, fullDomain, onClose }) {
  const containerRef = useRef(null)
  const [view, setView] = useState(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [orientationLocked, setOrientationLocked] = useState(false)
  const rotated = viewport.height > viewport.width && !orientationLocked

  useEffect(() => {
    const overlay = document.documentElement
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const lockLandscape = async () => {
      try {
        await overlay.requestFullscreen?.()
        await window.screen.orientation?.lock?.('landscape')
        setOrientationLocked(true)
      } catch {
        setOrientationLocked(false)
      }
    }

    lockLandscape()

    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)

      try {
        window.screen.orientation?.unlock?.()
        if (document.fullscreenElement) document.exitFullscreen?.()
      } catch {
        // Ignorado: no todos los navegadores soportan estas APIs.
      }
    }
  }, [onClose])

  useEffect(() => {
    const element = containerRef.current

    if (!element) return undefined

    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [rotated, viewport])

  const dims = useMemo(
    () => ({
      width: Math.max(size.width, 200),
      height: Math.max(size.height, 120),
      padding: 36,
      font: 12,
      smallFont: 11,
    }),
    [size],
  )
  const handleViewChange = useCallback((next) => setView(next), [])
  const zoomBy = (factor) => {
    const current = view ?? fullDomain
    const center = (current.minTime + current.maxTime) / 2
    const span = (current.maxTime - current.minTime) * factor

    setView(clampView({ minTime: center - span / 2, maxTime: center + span / 2 }, fullDomain))
  }
  const isZoomed = view !== null

  const layoutStyle = rotated
    ? {
        position: 'fixed',
        top: 0,
        left: viewport.width,
        width: viewport.height,
        height: viewport.width,
        transform: 'rotate(90deg)',
        transformOrigin: '0 0',
      }
    : { position: 'fixed', inset: 0 }

  const buttonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40'

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div style={layoutStyle} className="flex flex-col bg-slate-950 p-3 text-white">
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="flex flex-wrap items-center gap-3">
            {series.map((serie) => (
              <span
                key={serie.id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: serie.color }}
                />
                {serie.title}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={buttonClass} onClick={() => zoomBy(1.5)} aria-label="Alejar">
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className={buttonClass} onClick={() => zoomBy(1 / 1.5)} aria-label="Acercar">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className={buttonClass} onClick={() => setView(null)} disabled={!isZoomed} aria-label="Restablecer zoom">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className={buttonClass} onClick={onClose} aria-label="Cerrar pantalla completa">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
          {size.width > 0 && (
            <ChartCanvas
              series={series}
              dims={dims}
              fullDomain={fullDomain}
              view={view}
              onViewChange={handleViewChange}
              interactive
              rotated={rotated}
            />
          )}
        </div>
        <p className="pt-1 text-center text-[11px] text-slate-400">
          Pellizca o usa +/− para hacer zoom, arrastra para moverte y toca para ver el detalle.
        </p>
      </div>
    </div>,
    document.body,
  )
}

function HistoryChart({ historyById, loading, error, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState(['dolar-oficial', 'dolar-paralelo'])
  const [fullscreen, setFullscreen] = useState(false)
  const closeFullscreen = useCallback(() => setFullscreen(false), [])

  const selectedSeries = useMemo(() => {
    return RATE_OPTIONS.map((option) => ({
      ...option,
      history: historyById[option.id] ?? [],
    })).filter((serie) => selectedIds.includes(serie.id) && serie.history.length > 0)
  }, [historyById, selectedIds])

  const timeDomain = useMemo(() => {
    return getTimeDomain(selectedSeries)
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
        ) : selectedSeries.length === 0 ? (
          <div className="flex h-64 items-center justify-center px-6 text-center text-slate-300">
            No hay datos históricos para las monedas seleccionadas.
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="absolute right-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200 transition hover:bg-white/15"
              aria-label="Ampliar gráfica a pantalla completa"
              title="Ampliar"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <ChartCanvas
              series={selectedSeries}
              dims={INLINE_DIMS}
              fullDomain={timeDomain}
              view={null}
              onViewChange={() => {}}
            />
          </div>
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

      {fullscreen && timeDomain && (
        <FullscreenChart
          series={selectedSeries}
          fullDomain={timeDomain}
          onClose={closeFullscreen}
        />
      )}
    </section>
  )
}

export default HistoryChart
