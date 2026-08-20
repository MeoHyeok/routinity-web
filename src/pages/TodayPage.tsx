import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Sun, BookOpen, Utensils, Coffee, TriangleAlert, Inbox, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { Card } from '../components/Card'
import { LogTypeIcon } from '../components/LogTypeIcon'
import { SleepReportModal } from '../components/SleepReportModal'
import { Spinner } from '../components/Spinner'
import { TimeBreakdown } from '../components/TimeBreakdown'
import {
  fetchScores, fetchLogs, fetchReport, recordLog, kstDateKey, shiftKstDateKey, GoalTargetType, logDisplayName,
  type LogEntry, type LogType, type Report, type ScoresResponse,
} from '../lib/api'
import { fetchTodayLogsWithCarryover } from '../lib/todayLogs'
import { computeRoutineDayMetrics, durationLabel } from '../lib/routineDayMetrics'
import { loadScoreTrend, type ScoreTrendPoint } from '../lib/trend'
import { computeStreakDays, computePersonalAverageScore } from '../lib/goalSuggestion'

const dateHeadingFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' })
const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'long', timeZone: 'Asia/Seoul' })
const timeOnlyFormatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
const carryoverWakeFormatter = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })

function shiftKstDate(date: Date, deltaDays: number): Date {
  return new Date(`${shiftKstDateKey(kstDateKey(date), deltaDays)}T12:00:00+09:00`)
}

export function TodayPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [isCarryover, setIsCarryover] = useState(false)
  const [scores, setScores] = useState<ScoresResponse | null>(null)
  const [streakPoints, setStreakPoints] = useState<ScoreTrendPoint[]>([])
  const [recording, setRecording] = useState<LogType | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Shown right after 취침 is logged — mirrors RoutinityApp's SleepReportSheet, popped
  // automatically so the user sees that moment's daily report without navigating to AI 코치.
  const [showSleepReport, setShowSleepReport] = useState(false)
  const [sleepReport, setSleepReport] = useState<Report | null>(null)
  const [sleepReportLoading, setSleepReportLoading] = useState(false)
  const [sleepReportError, setSleepReportError] = useState<string | null>(null)

  // Timeline section's own date selection — kept local to that section rather than driving the
  // rest of the page (metrics/scores/quick-log buttons stay pinned to today regardless of what
  // date is being browsed in the timeline below).
  const [timelineDate, setTimelineDate] = useState(new Date())
  const [pastLogs, setPastLogs] = useState<LogEntry[] | null>(null)
  const [pastLogsError, setPastLogsError] = useState<string | null>(null)
  const isViewingToday = kstDateKey(timelineDate) === kstDateKey(new Date())

  // Guards against two overlapping `load()` calls (e.g. React StrictMode's double-invoked mount
  // effect, or a retry tap landing while an earlier call is still in flight) — only the most
  // recent call's result is allowed to touch state, so a slower stale call can't clobber a
  // faster newer one (or worse, apply its error on top of the newer call's already-good data).
  const loadRequestId = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++loadRequestId.current
    setErrorMessage(null)
    try {
      const [logsResult, scoresResult, pastTrendResult] = await Promise.all([
        fetchTodayLogsWithCarryover(),
        // Needed here (not just for its daily_score) for the full ScoreEntry list — wakeGoal/
        // studyGoal below read target_value/actual_value off it, which a bare ScoreTrendPoint
        // doesn't carry.
        fetchScores(new Date()),
        // 14 days, not more — even loadScoreTrend's one /scores call per day risks piling on top
        // of the calls above toward the 60/min rate limit on a single page load. Uses
        // loadScoreTrend (not loadTrend) since streak/personal-average only need each day's
        // score, not its full log list. Fetches only the *preceding* 13 days (endOffsetDays: 1)
        // and appends today's already-fetched score below, instead of letting loadScoreTrend
        // re-fetch /scores for today a second time.
        loadScoreTrend(13, 1),
      ])
      if (requestId !== loadRequestId.current) return
      setLogs(logsResult.logs)
      setIsCarryover(logsResult.isCarryover)
      setScores(scoresResult)
      setStreakPoints([...pastTrendResult, { date: new Date(), dailyScore: scoresResult.daily_score }])
    } catch (e) {
      if (requestId !== loadRequestId.current) return
      setErrorMessage(e instanceof Error ? e.message : '데이터를 불러오지 못했어요.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (isViewingToday) { setPastLogs(null); setPastLogsError(null); return }
    let ignore = false
    setPastLogs(null)
    setPastLogsError(null)
    fetchLogs(timelineDate)
      .then((result) => { if (!ignore) setPastLogs(result) })
      .catch((e) => { if (!ignore) setPastLogsError(e instanceof Error ? e.message : '불러오기 실패') })
    return () => { ignore = true }
  }, [timelineDate, isViewingToday])

  async function handleRecord(type: LogType) {
    setRecording(type)
    try {
      await recordLog(type, new Date())
      await load()
      if (type === 'sleep') {
        setShowSleepReport(true)
        setSleepReportLoading(true)
        setSleepReport(null)
        setSleepReportError(null)
        try {
          setSleepReport(await fetchReport('daily'))
        } catch (e) {
          setSleepReportError(e instanceof Error ? e.message : '리포트를 불러오지 못했어요.')
        } finally {
          setSleepReportLoading(false)
        }
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '기록에 실패했어요.')
    } finally {
      setRecording(null)
    }
  }

  if (!logs) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        {errorMessage ? (
          <>
            <p className="text-sm text-red-400 text-center">{errorMessage}</p>
            <button onClick={load} className="text-sm font-semibold text-routinity-violet">다시 시도</button>
          </>
        ) : (
          <Spinner />
        )}
      </div>
    )
  }

  const metrics = computeRoutineDayMetrics(logs)
  const streakDays = computeStreakDays(streakPoints)
  const personalAvg = computePersonalAverageScore(streakPoints)
  const delta = scores?.daily_score != null && personalAvg != null ? scores.daily_score - personalAvg : null
  const wakeGoal = scores?.scores.find((s) => s.target_type === GoalTargetType.wakeTime)
  const studyGoal = scores?.scores.find((s) => s.target_type === GoalTargetType.studyDuration)

  const carryoverText = isCarryover && metrics.actualWakeTime
    ? `${carryoverWakeFormatter.format(metrics.actualWakeTime)}에 기상하신 뒤 아직 취침을 기록하지 않았어요. 약 ${Math.max(0, Math.ceil(24 - (Date.now() - metrics.actualWakeTime.getTime()) / 3600000))}시간 후 자동으로 하루가 마감돼요.`
    : null

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-routinity-pink to-routinity-violet bg-clip-text text-transparent">루티니티</h1>
          <p className="text-sm text-white/60">오늘 루틴을 기록해보세요</p>
        </div>
        <Link to="/settings" className="w-10 h-10 rounded-full bg-routinity-card flex items-center justify-center">
          <Settings className="w-4.5 h-4.5" />
        </Link>
      </div>

      <Card glow>
        <div className="flex gap-4 items-center">
          <div className="relative w-[110px] h-[110px] shrink-0">
            <ScoreRing score={scores?.daily_score ?? null} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold">{scores?.daily_score ?? '-'}</span>
              <span className="text-[10px] font-semibold text-white/50">TODAY</span>
              {delta != null && (
                <span className={`text-[10px] font-semibold ${delta > 0 ? 'text-routinity-green' : delta < 0 ? 'text-routinity-pink' : 'text-white/50'}`}>
                  {delta === 0 ? '평소와 비슷' : `평소보다 ${delta > 0 ? '+' : ''}${delta}`}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <span className="text-xs text-white/50">{dateHeadingFormatter.format(new Date())}</span>
            <span className="text-lg font-bold">{weekdayFormatter.format(new Date())}</span>
            <div className="bg-white/6 rounded-xl px-3 py-1.5 text-center">
              <div className="font-semibold text-sm">{streakDays}일</div>
              <div className="text-[10px] text-white/50">연속 달성</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={Sun} tint="bg-routinity-orange/35" title="기상"
          value={metrics.actualWakeTime ? timeOnlyFormatter.format(metrics.actualWakeTime) : '-'}
          subtitle={wakeGoal ? `목표 ${wakeGoal.target_value}` : '목표 없음'} />
        <MetricCard icon={BookOpen} tint="bg-routinity-cyan/35" title="공부"
          value={durationLabel(metrics.totalStudyMinutes, metrics.hasClosedStudySession)}
          subtitle={studyGoal ? `목표 ${studyGoal.target_value}분` : '목표 없음'} />
        <Card className="!p-3 flex flex-col justify-between">
          <MealRestRow icon={Utensils} tint="bg-routinity-pink/35" value={durationLabel(metrics.totalMealMinutes, metrics.hasClosedMealSession)} label="식사" />
          <MealRestRow icon={Coffee} tint="bg-routinity-violet/35" value={metrics.restMinutesSoFar != null ? `${metrics.restMinutesSoFar}분` : '-'} label="휴식" />
        </Card>
      </div>

      {carryoverText && (
        <Card>
          <div className="flex gap-2.5 items-start">
            <TriangleAlert className="w-4 h-4 text-routinity-orange shrink-0 mt-0.5" />
            <p className="text-sm">{carryoverText}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60">간편 기록</h2>
        {/* 기상 is never locked (starting a day must always be possible), but 취침 locks while
            식사/공부 is still running — otherwise closing the day leaves that session open with
            no way to ever end it (wakeOpenSince becomes null, which used to lock its own end
            button too). 식사/공부's own end action is never locked, only their start — so a
            session that's already open can always be closed regardless of the other's state. */}
        <QuickLogButton
          openSince={metrics.wakeOpenSince} startType="wake" endType="sleep"
          isLocked={metrics.wakeOpenSince !== null && (metrics.mealOpenSince !== null || metrics.studyOpenSince !== null)}
          recording={recording} onTap={handleRecord}
        />
        <QuickLogButton
          openSince={metrics.mealOpenSince} startType="meal_start" endType="meal_end"
          isLocked={metrics.mealOpenSince === null && (metrics.wakeOpenSince === null || metrics.studyOpenSince !== null)}
          recording={recording} onTap={handleRecord}
        />
        <QuickLogButton
          openSince={metrics.studyOpenSince} startType="study_start" endType="study_end"
          isLocked={metrics.studyOpenSince === null && (metrics.wakeOpenSince === null || metrics.mealOpenSince !== null)}
          recording={recording} onTap={handleRecord}
          showsStopwatch
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60">타임라인</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTimelineDate((d) => shiftKstDate(d, -1))}
              aria-label="이전 날짜"
              className="w-6 h-6 flex items-center justify-center text-white/60"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Tapping the date text itself still opens the browser's native calendar, for
                jumping further back than one day at a time — the chevrons are just for the
                common case of stepping day by day. */}
            <input
              type="date"
              value={kstDateKey(timelineDate)}
              max={kstDateKey(new Date())}
              onChange={(e) => setTimelineDate(new Date(`${e.target.value}T12:00:00+09:00`))}
              className="bg-white/6 border border-routinity-border rounded-lg px-2 py-1 text-xs text-white outline-none"
            />
            <button
              onClick={() => setTimelineDate((d) => shiftKstDate(d, 1))}
              disabled={isViewingToday}
              aria-label="다음 날짜"
              className="w-6 h-6 flex items-center justify-center text-white/60 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {(() => {
          const displayedLogs = isViewingToday ? logs : pastLogs
          if (!isViewingToday && pastLogsError) {
            return <Card><p className="text-sm text-red-400 text-center py-8">{pastLogsError}</p></Card>
          }
          if (!displayedLogs) {
            return <Card><div className="flex justify-center py-8"><Spinner /></div></Card>
          }
          if (displayedLogs.length === 0) {
            return (
              <Card>
                <div className="flex flex-col items-center gap-2 py-8 text-white/40">
                  <Inbox className="w-6 h-6" />
                  <p className="text-sm">{isViewingToday ? '아직 기록이 없어요.' : '이 날짜에는 기록이 없어요.'}</p>
                </div>
              </Card>
            )
          }
          // Computed client-side from that day's own logs (not the AI report's time_breakdown,
          // which is period-scoped and cached once a day) so the chart stays live and works for
          // any date the timeline picker lands on, not just whichever day last generated a report.
          // For a past date, "now" must be capped at that day's own last log — otherwise a day
          // whose 취침 was never logged (wakeOpenSince stays open) computes restMinutesSoFar against
          // the real current time, which can be days later than the date being viewed and balloons
          // 휴식/활동 시간 into a nonsensical number.
          const lastLogTime = displayedLogs.reduce((max, l) => Math.max(max, new Date(l.timestamp).getTime()), 0)
          const dayMetrics = computeRoutineDayMetrics(displayedLogs, isViewingToday ? new Date() : new Date(lastLogTime))
          const breakdown = {
            meal_minutes: dayMetrics.totalMealMinutes,
            study_minutes: dayMetrics.totalStudyMinutes,
            rest_minutes: dayMetrics.restMinutesSoFar ?? 0,
            active_minutes: dayMetrics.totalMealMinutes + dayMetrics.totalStudyMinutes + (dayMetrics.restMinutesSoFar ?? 0),
          }
          return (
            <>
              <TimeBreakdown breakdown={breakdown} />
              <Card className="!p-0 overflow-hidden">
                <ul className="flex flex-col divide-y divide-routinity-border px-4">
                  {[...displayedLogs].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((log) => (
                    <li key={log.id} className="flex items-center gap-3 py-3">
                      <div className="w-8 h-8 rounded-full bg-routinity-violet/12 flex items-center justify-center shrink-0"><LogTypeIcon type={log.type} className="w-3.5 h-3.5" /></div>
                      <span className="flex-1 text-sm">{logDisplayName(log.type)}</span>
                      <span className="text-white/50 text-sm">{timeOnlyFormatter.format(new Date(log.timestamp))}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )
        })()}
      </div>

      {errorMessage && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button onClick={load} className="text-sm font-semibold text-routinity-violet">다시 시도</button>
        </div>
      )}

      {showSleepReport && (
        <SleepReportModal
          isLoading={sleepReportLoading}
          report={sleepReport}
          errorMessage={sleepReportError}
          onClose={() => setShowSleepReport(false)}
        />
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number | null }) {
  const pct = score ?? 0
  const r = 48
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
      {score != null && (
        <circle
          cx="55" cy="55" r={r} fill="none" stroke="url(#grad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      )}
      <defs>
        <linearGradient id="grad">
          <stop offset="0%" stopColor="#fa944a" />
          <stop offset="100%" stopColor="#ed619e" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function MetricCard({ icon: Icon, tint, title, value, subtitle }: { icon: LucideIcon; tint: string; title: string; value: string; subtitle: string }) {
  return (
    <Card className="!p-3 flex flex-col gap-2 items-start">
      <div className={`w-8 h-8 rounded-[9px] ${tint} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
      <div className="font-bold text-[15px] truncate w-full">{value}</div>
      <div className="text-xs text-white/60">{title}</div>
      <div className="text-[10px] text-white/40">{subtitle}</div>
    </Card>
  )
}

function MealRestRow({ icon: Icon, tint, value, label }: { icon: LucideIcon; tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5.5 h-5.5 rounded-md ${tint} flex items-center justify-center`}><Icon className="w-3 h-3" /></div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-[10px] text-white/50">{label}</span>
      </div>
    </div>
  )
}

function QuickLogButton({
  openSince, startType, endType, isLocked, recording, onTap, showsStopwatch,
}: {
  openSince: Date | null; startType: LogType; endType: LogType
  isLocked: boolean; recording: LogType | null; onTap: (type: LogType) => void; showsStopwatch?: boolean
}) {
  const inProgress = openSince !== null
  const type = inProgress ? endType : startType
  const displayName = logDisplayName(type)
  const isRecordingThis = recording === startType || recording === endType
  return (
    <button
      disabled={isLocked || recording !== null}
      onClick={() => onTap(type)}
      className="text-left"
    >
      <Card className="!p-3 flex items-center gap-3 disabled:opacity-50">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isLocked ? 'bg-routinity-violet/12' : 'bg-routinity-violet/30'}`}>
          {isRecordingThis ? <Spinner /> : <LogTypeIcon type={type} locked={isLocked} className="w-4 h-4" />}
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-sm font-medium ${isLocked ? 'text-white/50' : 'text-white'}`}>{displayName}</span>
          {inProgress && showsStopwatch && openSince && <Stopwatch since={openSince} />}
        </div>
      </Card>
    </button>
  )
}

function Stopwatch({ since }: { since: Date }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsed = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000))
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')
  return <span className="text-xs text-routinity-cyan font-mono">{h}:{m}:{s}</span>
}

