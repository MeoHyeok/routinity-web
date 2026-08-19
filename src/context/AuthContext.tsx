import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Maps Supabase Auth's raw English error codes to Korean, mirroring
 *  RoutinityApp/Services/APIError.swift's `friendlyAuthErrorMessage`. */
function friendlyAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 올바르지 않아요.'
    case 'email_exists':
    case 'user_already_exists':
      return '이미 가입된 이메일이에요. 로그인을 시도해주세요.'
    case 'weak_password':
      return '비밀번호가 너무 짧아요. 6자 이상으로 입력해주세요.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
    case 'email_not_confirmed':
      return '이메일 인증이 필요해요. 받은 메일함을 확인해주세요.'
    default:
      return `로그인 처리 중 문제가 발생했어요${error.code ? ` (${error.code})` : ''}.`
  }
}

interface AuthContextValue {
  session: Session | null
  hasLoadedInitialSession: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [hasLoadedInitialSession, setHasLoadedInitialSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setHasLoadedInitialSession(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? friendlyAuthErrorMessage(error) : null
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: friendlyAuthErrorMessage(error), needsConfirmation: false }
    return { error: null, needsConfirmation: data.session === null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, hasLoadedInitialSession, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
