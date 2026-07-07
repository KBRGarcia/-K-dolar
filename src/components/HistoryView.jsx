import HistoryChart from './HistoryChart'
import HistoryTable from './HistoryTable'

function HistoryView({ historyById, loading, error, onRefresh }) {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <HistoryChart
        historyById={historyById}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
      />
      <HistoryTable historyById={historyById} loading={loading} />
    </div>
  )
}

export default HistoryView
