import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import {
  fetchScores, recordLog, GoalTargetType,
  type LogEntry, type LogType, type ScoresResponse,
} from '../lib/api'
import { fetchTodayLogsWithCarryover } from '../lib/todayLogs'
import { computeRoutineDayMetrics, durationLabel } from '../lib/routineDayMetrics'
import { loadTrend } from '../lib/trend'
import { computeStreakDays, computePersonalAverageScore, type DailyTrendPoint } from '../lib/goalSuggestion'

const dateHeadingFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' })
const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'long', timeZone: 'Asia/Seoul' })
const timeOnlyFormatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
const carryoverWakeFormatter = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })

export function TodayPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [isCarryover, setIsCarryover] = useState(false)
  const [scores, setScores] = useState<ScoresResponse | null>(null)
  const [streakPoints, setStreakPoints] = useState<DailyTrendPoint[]>([])
  const [recording, setRecording] = useState<LogType | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErrorMessage(null)
    try {
      const [logsResult, scoresResult, trendResult] = await Promise.all([
        fetchTodayLogsWithCarryover(),
        fetchScores(new Date()),
        // 14 days, not more — loadTrend fires one /scores + one /logs call per day, and piling
        // on top of the calls above risks the 60/min rate limit on a single page load.
        loadTrend(14),
      ])
      setLogs(logsResult.logs)
      setIsCarryover(logsResult.isCarryover)
      setScores(scoresResult)
      setStreakPoints(trendResult)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '데이터를 불러오지 못했어요.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRecord(type: LogType) {
    setRecording(type)
    try {
      await recordLog(type, new Date())
      await load()
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '기록에 실패했어요.')
    } finally {
      setRecording(null)
    }
  }

  if (!logs) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
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
        <Link to="/settings" className="w-10 h-10 rounded-full bg-routinity-card flex items-center justify-center">⚙️</Link>
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
        <MetricCard icon="☀️" tint="bg-routinity-orange/35" title="기상"
          value={metrics.actualWakeTime ? timeOnlyFormatter.format(metrics.actualWakeTime) : '-'}
          subtitle={wakeGoal ? `목표 ${wakeGoal.target_value}` : '목표 없음'} />
        <MetricCard icon="📖" tint="bg-routinity-cyan/35" title="공부"
          value={durationLabel(metrics.totalStudyMinutes, metrics.hasClosedStudySession)}
          subtitle={studyGoal ? `목표 ${studyGoal.target_value}분` : '목표 없음'} />
        <Card className="!p-3 flex flex-col justify-between">
          <MealRestRow icon="🍴" value={durationLabel(metrics.totalMealMinutes, metrics.hasClosedMealSession)} label="식사" />
          <MealRestRow icon="☕" value={metrics.restMinutesSoFar != null ? `${metrics.restMinutesSoFar}분` : '-'} label="휴식" />
        </Card>
      </div>

      {carryoverText && (
        <Card>
          <div className="flex gap-2.5 items-start">
            <span>⚠️</span>
            <p className="text-sm">{carryoverText}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white/60">간편 기록</h2>
        <QuickLogButton
          icon="🌙" openSince={metrics.wakeOpenSince} startType="wake" endType="sleep"
          isLocked={false} recording={recording} onTap={handleRecord}
        />
        <QuickLogButton
          icon="🍴" openSince={metrics.mealOpenSince} startType="meal_start" endType="meal_end"
          isLocked={metrics.wakeOpenSince === null || metrics.studyOpenSince !== null} recording={recording} onTap={handleRecord}
        />
        <QuickLogButton
          icon="📖" openSince={metrics.studyOpenSince} startType="study_start" endType="study_end"
          isLocked={metrics.wakeOpenSince === null || metrics.mealOpenSince !== null} recording={recording} onTap={handleRecord}
          showsStopwatch
        />
      </div>

      {errorMessage && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button onClick={load} className="text-sm font-semibold text-routinity-violet">다시 시도</button>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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

function MetricCard({ icon, tint, title, value, subtitle }: { icon: string; tint: string; title: string; value: string; subtitle: string }) {
  return (
    <Card className="!p-3 flex flex-col gap-2 items-start">
      <div className={`w-8 h-8 rounded-[9px] ${tint} flex items-center justify-center text-sm`}>{icon}</div>
      <div className="font-bold text-[15px] truncate w-full">{value}</div>
      <div className="text-xs text-white/60">{title}</div>
      <div className="text-[10px] text-white/40">{subtitle}</div>
    </Card>
  )
}

function MealRestRow({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5.5 h-5.5 rounded-md bg-routinity-pink/35 flex items-center justify-center text-[10px]">{icon}</div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-[10px] text-white/50">{label}</span>
      </div>
    </div>
  )
}

function QuickLogButton({
  icon, openSince, startType, endType, isLocked, recording, onTap, showsStopwatch,
}: {
  icon: string; openSince: Date | null; startType: LogType; endType: LogType
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
          {isRecordingThis ? <Spinner /> : <span>{isLocked ? '🔒' : icon}</span>}
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

function logDisplayName(type: LogType): string {
  switch (type) {
    case 'wake': return '기상'
    case 'sleep': return '취침'
    case 'meal_start': return '식사 시작'
    case 'meal_end': return '식사 종료'
    case 'study_start': return '공부 시작'
    case 'study_end': return '공부 종료'
  }
}
