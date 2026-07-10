import { useState } from 'react'
import Converter from './components/Converter'
import DownloadBtn from './components/DownloadBtn'
import Footer from './components/Footer'
import Header from './components/Header'
import HistoryView from './components/HistoryView'
import { DEFAULT_RATE_ID } from './constants/rates'
import useExchangeRates from './hooks/useExchangeRates'
import useHistoricalRates from './hooks/useHistoricalRates'

function App() {
  const [activeView, setActiveView] = useState('calculator')
  const [selectedRateId, setSelectedRateId] = useState(DEFAULT_RATE_ID)
  const {
    ratesById,
    updatedAt,
    loading,
    error,
    refresh,
  } = useExchangeRates()
  const {
    historyById,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useHistoricalRates(activeView === 'history')
  const activeRate = ratesById[selectedRateId] ?? null

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_30%)]" />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 sm:gap-6">
        <Header
          ratesById={ratesById}
          selectedRateId={selectedRateId}
          updatedAt={updatedAt}
          loading={loading}
          onRefresh={refresh}
          onSelectRate={setSelectedRateId}
        />

        <nav className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/10 p-2 backdrop-blur">
          {[
            ['calculator', 'Calculadora'],
            ['history', 'Histórico'],
          ].map(([viewId, label]) => (
            <button
              key={viewId}
              type="button"
              onClick={() => setActiveView(viewId)}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                activeView === viewId
                  ? 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="rounded-3xl border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
            <strong className="font-semibold">No se pudo actualizar.</strong>{' '}
            {error}
          </div>
        )}

        {activeView === 'calculator' ? (
          <Converter rate={activeRate} loading={loading} />
        ) : (
          <HistoryView
            historyById={historyById}
            loading={historyLoading}
            error={historyError}
            onRefresh={refreshHistory}
          />
        )}

        <DownloadBtn />
        <Footer />
      </div>
    </main>
  )
}

export default App
