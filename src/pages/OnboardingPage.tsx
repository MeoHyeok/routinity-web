import { useEffect, useRef, useState } from 'react'
import { Sun, Target, Sparkles, type LucideIcon } from 'lucide-react'
import { ensureDefaultGoals, DEFAULT_WAKE_TIME, DEFAULT_STUDY_MINUTES } from '../lib/defaultGoals'

// Mirrors RoutinityApp's OnboardingView.swift — shown once, the first time this device reaches
// the authenticated app, before landing on a blank 오늘 화면 with no context for what the
// buttons do. Device-local (localStorage) rather than per-account, same tradeoff iOS makes: a
// fresh browser re-showing it for an existing account beats needing a server round trip just to
// gate a one-time tutorial.
interface Slide {
  icon: LucideIcon
  tint: string
  title: string
  body: string
}

const slides: Slide[] = [
  {
    icon: Sun,
    tint: 'text-routinity-orange',
    title: '원탭으로 루틴을 기록하세요',
    body: '기상, 식사, 공부 — 버튼 하나만 누르면 지금 이 순간이 기록돼요. 다시 누르면 종료돼요.',
  },
  {
    icon: Target,
    tint: 'text-routinity-cyan',
    title: '목표를 세우면 점수가 매겨져요',
    body: '기상 시간과 공부 시간 목표를 설정하면, 오늘 얼마나 지켰는지 자동으로 채점해드려요.',
  },
  {
    icon: Sparkles,
    tint: 'text-routinity-violet',
    title: 'AI 코치가 리포트를 써드려요',
    body: '하루·주간·월간 리포트와 다음 액션 제안까지, 기록만 하면 AI가 알아서 정리해드려요.',
  },
]

const tintBg: Record<string, string> = {
  'text-routinity-orange': 'bg-routinity-orange/15',
  'text-routinity-cyan': 'bg-routinity-cyan/15',
  'text-routinity-violet': 'bg-routinity-violet/15',
}

function formatMinutesAsHours(minutes: string): string {
  const total = Number(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export function OnboardingPage({ onFinish }: { onFinish: () => void }) {
  const [page, setPage] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const isLast = page === slides.length - 1

  useEffect(() => {
    // Best-effort — this is a background nicety, not a user-initiated action, so a failure here
    // (rate limit, network blip) shouldn't block or error out the onboarding flow itself.
    ensureDefaultGoals().catch(() => {})
  }, [])

  function goTo(index: number) {
    setPage(index)
    scrollerRef.current?.scrollTo({ left: index * scrollerRef.current.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    if (index !== page) setPage(index)
  }

  return (
    <div className="flex-1 flex flex-col pb-6 bg-routinity-bg">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {slides.map((slide) => (
          <SlideView key={slide.title} slide={slide} />
        ))}
      </div>

      <div className="flex justify-center items-center gap-2 pb-5">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-200 ${index === page ? 'w-5 bg-routinity-violet' : 'w-1.5 bg-white/15'}`}
          />
        ))}
      </div>

      <p className="px-8 pb-5 text-center text-xs text-white/50">
        기상 {DEFAULT_WAKE_TIME}·공부 {formatMinutesAsHours(DEFAULT_STUDY_MINUTES)}으로 기본 목표를 설정해드렸어요. 설정 화면에서 언제든 바꾸실 수 있어요.
      </p>

      <div className="px-6">
        <button
          onClick={() => (isLast ? onFinish() : goTo(page + 1))}
          className="w-full bg-routinity-violet rounded-2xl py-3.5 font-semibold text-white"
        >
          {isLast ? '시작하기' : '다음'}
        </button>
      </div>

      {isLast ? (
        <div className="h-[31px]" />
      ) : (
        <button onClick={onFinish} className="mt-3.5 text-sm text-white/50 self-center">건너뛰기</button>
      )}
    </div>
  )
}

function SlideView({ slide: { icon: Icon, tint, title, body } }: { slide: Slide }) {
  return (
    <div className="w-full shrink-0 snap-center flex flex-col items-center justify-center gap-6 px-8">
      <div className={`w-[120px] h-[120px] rounded-full ${tintBg[tint]} flex items-center justify-center`}>
        <Icon className={`w-11 h-11 ${tint}`} />
      </div>
      <div className="flex flex-col gap-2.5 text-center">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-white/60">{body}</p>
      </div>
    </div>
  )
}
