import type { ReactNode } from 'react'

export function Card({ children, glow = false, className = '' }: { children: ReactNode; glow?: boolean; className?: string }) {
  return (
    <div
      className={`rounded-[20px] bg-routinity-card border p-4 ${glow ? 'border-routinity-violet/35 shadow-[0_8px_20px_rgba(140,92,245,0.28)]' : 'border-routinity-border'} ${className}`}
    >
      {children}
    </div>
  )
}
