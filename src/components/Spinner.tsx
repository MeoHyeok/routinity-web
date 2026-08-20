// Shared loading spinner — was independently copy-pasted into TodayPage, AnalysisPage,
// AICoachPage, SleepReportModal, and App's initial-session gate.
export function Spinner() {
  return <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
}
