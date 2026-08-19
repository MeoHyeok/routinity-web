import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { fetchGoals, upsertGoal, deleteGoal, GoalTargetType } from '../lib/api'

const starterWakeTime = '07:00'
const starterStudyMinutes = '120'

export function GoalsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [wakeTime, setWakeTime] = useState('')
  const [studyMinutes, setStudyMinutes] = useState('')
  const [hasWakeGoal, setHasWakeGoal] = useState(false)
  const [hasStudyGoal, setHasStudyGoal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const suggestedWakeTime = params.get('wake')
  const suggestedStudyMinutes = params.get('study')

  async function load() {
    setIsLoading(true)
    try {
      const goals = await fetchGoals()
      const wake = goals.find((g) => g.target_type === GoalTargetType.wakeTime)
      const study = goals.find((g) => g.target_type === GoalTargetType.studyDuration)
      setWakeTime(wake?.target_value ?? '')
      setStudyMinutes(study?.target_value ?? '')
      setHasWakeGoal(!!wake)
      setHasStudyGoal(!!study)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setErrorMessage(null)
    setSavedMessage(null)
    setIsSaving(true)
    // Fired concurrently (not awaited one after another) and caught independently so one field
    // failing doesn't stop the other's edit from being sent.
    const attempts: Promise<unknown>[] = []
    if (wakeTime) attempts.push(upsertGoal(GoalTargetType.wakeTime, wakeTime))
    if (studyMinutes) attempts.push(upsertGoal(GoalTargetType.studyDuration, studyMinutes))
    const results = await Promise.allSettled(attempts)
    await load()
    setIsSaving(false)
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failure) setErrorMessage(failure.reason instanceof Error ? failure.reason.message : '저장 실패')
    else if (results.some((r) => r.status === 'fulfilled')) setSavedMessage('저장되었습니다.')
  }

  async function handleDelete(type: string) {
    try {
      await deleteGoal(type)
      if (type === GoalTargetType.wakeTime) { setWakeTime(''); setHasWakeGoal(false) }
      else { setStudyMinutes(''); setHasStudyGoal(false) }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/60">←</button>
        <h1 className="text-lg font-bold">목표 설정</h1>
      </div>

      {!isLoading && !hasWakeGoal && !hasStudyGoal && (
        <Card glow>
          <div className="flex items-center gap-1.5 mb-2">
            <span>✨</span>
            <span className="text-sm font-semibold">아직 설정한 루틴이 없어요</span>
          </div>
          <p className="text-sm text-white/60 mb-3">기상 {starterWakeTime} · 공부 {starterStudyMinutes}분으로 가볍게 시작해보세요. 나중에 언제든 조정할 수 있어요.</p>
          <button onClick={() => { setWakeTime(starterWakeTime); setStudyMinutes(starterStudyMinutes) }} className="text-sm font-semibold text-routinity-violet">
            이 루틴으로 시작하기
          </button>
        </Card>
      )}

      <Card>
        <p className="font-semibold mb-1">기상 목표</p>
        <p className="text-xs text-white/50 mb-3">몇 시에 기상하고 싶으신가요?</p>
        <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
          className="bg-white/6 border border-routinity-border rounded-xl px-3 py-2 text-white outline-none" />
        {suggestedWakeTime && (
          <button onClick={() => setWakeTime(suggestedWakeTime)} className="ml-2 text-xs font-semibold text-routinity-violet bg-routinity-violet/12 rounded-full px-2.5 py-1.5">
            ✨ 제안: {suggestedWakeTime}
          </button>
        )}
        {hasWakeGoal && <button onClick={() => handleDelete(GoalTargetType.wakeTime)} className="block mt-3 text-xs text-red-400 font-semibold">목표 삭제</button>}
      </Card>

      <Card>
        <p className="font-semibold mb-1">공부 시간 목표</p>
        <p className="text-xs text-white/50 mb-3">분 단위, 예: 120</p>
        <input type="number" placeholder="예: 120" value={studyMinutes} onChange={(e) => setStudyMinutes(e.target.value)}
          className="bg-white/6 border border-routinity-border rounded-xl px-3 py-2 text-white outline-none w-full" />
        {suggestedStudyMinutes && (
          <button onClick={() => setStudyMinutes(suggestedStudyMinutes)} className="mt-2 text-xs font-semibold text-routinity-violet bg-routinity-violet/12 rounded-full px-2.5 py-1.5">
            ✨ 제안: {suggestedStudyMinutes}분
          </button>
        )}
        {hasStudyGoal && <button onClick={() => handleDelete(GoalTargetType.studyDuration)} className="block mt-3 text-xs text-red-400 font-semibold">목표 삭제</button>}
      </Card>

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
      {savedMessage && <p className="text-sm text-white/60">{savedMessage}</p>}

      <button onClick={save} disabled={isSaving} className="bg-routinity-violet disabled:opacity-40 rounded-2xl py-3.5 font-semibold">
        {isSaving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}
