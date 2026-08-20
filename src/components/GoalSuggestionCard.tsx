import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { Card } from './Card'
import type { GoalSuggestion } from '../lib/goalSuggestion'

export function GoalSuggestionCard({ suggestion }: { suggestion: GoalSuggestion }) {
  const params = new URLSearchParams()
  if (suggestion.suggestedWakeTime) params.set('wake', suggestion.suggestedWakeTime)
  if (suggestion.suggestedStudyMinutes) params.set('study', suggestion.suggestedStudyMinutes)

  return (
    <Card glow>
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-4 h-4 text-routinity-orange" />
        <span className="text-sm font-semibold">목표 제안</span>
      </div>
      <p className="text-sm text-white/60 mb-3">
        {suggestion.lossTitle}이 최근 {Math.round(suggestion.missRate * 100)}%로 잦아요. 최근 실제 평균에 맞춰 목표를 {suggestion.suggestedLabel}로 조정해보는 건 어떨까요?
      </p>
      <Link to={`/goals?${params.toString()}`} className="text-sm font-semibold text-routinity-violet">목표 조정하러 가기</Link>
    </Card>
  )
}
