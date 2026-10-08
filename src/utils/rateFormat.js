const vesFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

export function roundRate(value) {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(value)

  if (!Number.isFinite(numeric)) return null

  return Number(numeric.toFixed(4))
}

export function formatVes(value) {
  const rounded = roundRate(value)

  if (rounded === null) return 'No disponible'

  return `Bs. ${vesFormatter.format(rounded)}`
}

export function formatVesDecimal(value) {
  const rounded = roundRate(value)

  if (rounded === null) return 'No disponible'

  return vesFormatter.format(rounded)
}
