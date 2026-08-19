import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  async function submit() {
    setErrorMessage(null)
    setInfoMessage(null)
    setIsLoading(true)
    try {
      if (mode === 'signIn') {
        const error = await signIn(email, password)
        if (error) setErrorMessage(error)
      } else {
        const { error, needsConfirmation } = await signUp(email, password)
        if (error) setErrorMessage(error)
        else if (needsConfirmation) setInfoMessage('가입 확인 이메일을 보냈습니다. 메일함을 확인한 뒤 로그인해주세요.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 gap-7">
      <div className="flex flex-col items-center gap-3 mb-4">
        <img src={`${import.meta.env.BASE_URL}app-icon-192.png`} alt="루티니티" className="w-[76px] h-[76px] rounded-[18px]" />
        <h1 className="text-3xl font-bold">루티니티</h1>
      </div>

      <div className="flex rounded-full bg-routinity-card p-1">
        {(['signIn', 'signUp'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
              mode === m ? 'bg-routinity-violet text-white' : 'text-white/60'
            }`}
          >
            {m === 'signIn' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-routinity-card border border-routinity-border rounded-2xl px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-routinity-violet"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-routinity-card border border-routinity-border rounded-2xl px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-routinity-violet"
        />
      </div>

      <div className="flex flex-col gap-2 text-left">
        {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        {infoMessage && <p className="text-sm text-white/60">{infoMessage}</p>}
      </div>

      <button
        onClick={submit}
        disabled={isLoading || !email || !password}
        className="bg-routinity-violet disabled:opacity-40 rounded-2xl py-3.5 font-semibold text-white"
      >
        {isLoading ? '처리 중...' : mode === 'signIn' ? '로그인' : '가입하기'}
      </button>
    </div>
  )
}
