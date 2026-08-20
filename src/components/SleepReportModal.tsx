import { X } from 'lucide-react'
import { Card } from './Card'
import { Spinner } from './Spinner'
import { TimeBreakdown } from './TimeBreakdown'
import type { Report } from '../lib/api'

// Mirrors RoutinityApp's SleepReportSheet (TodayView.swift) — shown right after 취침 is logged,
// the daily report generated from that moment's data, auto-popped so the user sees "오늘 하루
// 어땠는지" immediately instead of having to navigate to AI 코치 themselves.
export function SleepReportModal({
  isLoading, report, errorMessage, onClose,
}: {
  isLoading: boolean
  report: Report | null
  errorMessage: string | null
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-[420px] max-h-[85vh] overflow-y-auto bg-routinity-bg rounded-t-[24px] sm:rounded-[24px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">오늘 리포트</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-routinity-card flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : report ? (
          <>
            <Card>
              <p className="whitespace-pre-wrap text-[15px]">{report.content}</p>
            </Card>
            {report.suggested_action && (
              <Card glow>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm font-semibold">다음 액션 제안</span>
                </div>
                <p className="text-[15px]">{report.suggested_action}</p>
              </Card>
            )}
            {report.time_breakdown && <TimeBreakdown breakdown={report.time_breakdown} />}
          </>
        ) : errorMessage ? (
          <p className="text-sm text-red-400">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}
