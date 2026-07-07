export const API_BASE_URL = 'https://ve.dolarapi.com'

export const RATE_OPTIONS = [
  {
    id: 'dolar-oficial',
    title: 'Dólar Oficial',
    shortTitle: 'Dólar',
    currency: 'USD',
    symbol: '$',
    source: 'oficial',
    endpoint: '/v1/dolares/oficial',
    historyEndpoint: '/v1/historicos/dolares/oficial',
    color: '#38bdf8',
  },
  {
    id: 'dolar-paralelo',
    title: 'Dólar Paralelo',
    shortTitle: 'Dólar Paralelo',
    currency: 'USD',
    symbol: '$',
    source: 'paralelo',
    endpoint: '/v1/dolares/paralelo',
    historyEndpoint: '/v1/historicos/dolares/paralelo',
    color: '#22c55e',
  },
  {
    id: 'euro-oficial',
    title: 'Euro Oficial',
    shortTitle: 'Euro',
    currency: 'EUR',
    symbol: '€',
    source: 'oficial',
    endpoint: '/v1/euros/oficial',
    historyEndpoint: '/v1/historicos/euros/oficial',
    color: '#f59e0b',
  },
]

export const DEFAULT_RATE_ID = RATE_OPTIONS[0].id
