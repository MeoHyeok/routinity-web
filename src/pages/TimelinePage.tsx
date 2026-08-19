import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchLogs, deleteLog, logDisplayName, logIcon, kstDateKey, type LogEntry } from '../lib/api'

const timeFormatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })

export function TimelinePage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setLogs(null)
    setErrorMessage(null)
    setDeleteError(null)
    fetchLogs(selectedDate).then(setLogs).catch((e) => setErrorMessage(e.message))
  }, [selectedDate])

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteLog(id)
      setLogs((prev) => prev?.filter((l) => l.id !== id) ?? null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const sorted = logs ? [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) : []

  return (
    <div className="flex-1 flex flex-col gap-4 p-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/60">←</button>
        <h1 className="text-lg font-bold">타임라인</h1>
      </div>

      <input
        type="date"
        value={kstDateKey(selectedDate)}
        max={kstDateKey(new Date())}
        onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00+09:00`))}
        className="bg-white/6 border border-routinity-border rounded-xl px-3 py-2 text-white outline-none self-start"
      />

      {!logs ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
      ) : errorMessage ? (
        <p className="text-sm text-red-400">{errorMessage}</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-white/40">
          <span className="text-2xl">📭</span>
          <p className="text-sm">이 날짜에는 기록이 없습니다.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-routinity-border">
          {sorted.map((log) => (
            <li key={log.id} className="flex items-center gap-3.5 py-3">
              <div className="w-9 h-9 rounded-full bg-routinity-violet/12 flex items-center justify-center text-sm">{logIcon(log.type)}</div>
              <span className="flex-1">{logDisplayName(log.type)}</span>
              <span className="text-white/50 text-sm">{timeFormatter.format(new Date(log.timestamp))}</span>
              <button onClick={() => handleDelete(log.id)} className="text-red-400 text-xs">삭제</button>
            </li>
          ))}
        </ul>
      )}

      {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
    </div>
  )
}
