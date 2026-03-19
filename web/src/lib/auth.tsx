import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface Profile {
  id: string
  role: string
  team_id: string | null
  full_name: string | null
  company_name: string | null
  email: string | null
  avatar_url: string | null
  subscription_plan: string | null
  trial_started_at: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Tracks whether the initial getSession() call has already resolved.
  // onAuthStateChange must not reset loading — only getSession() does that on startup.
  const initialised = useRef(false)

  async function fetchProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data as Profile)
      return data as Profile
    } catch {
      setProfile(null)
      return null
    }
  }

  useEffect(() => {
    // Step 1: get the existing session synchronously from local storage,
    // then resolve any server-side refresh. This is the authoritative
    // source for the initial auth state — only this call marks init done.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => {
          initialised.current = true
          setLoading(false)
        })
      } else {
        initialised.current = true
        setLoading(false)
      }
    })

    // Step 2: listen for subsequent auth changes (sign-in, sign-out, token
    // refresh). Skip updating loading — init is owned by getSession above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        } else {
          setProfile(null)
        }
        // Only clear loading via this path if getSession() somehow never fired
        // (e.g. network error). Prevents permanent spinner.
        if (!initialised.current) {
          initialised.current = true
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }
      if (data.user) {
        const prof = await fetchProfile(data.user.id)
        if (!prof || (prof.role !== 'employer' && prof.role !== 'employer_plus')) {
          await supabase.auth.signOut()
          return {
            error: new Error(
              'This portal is for employer accounts only. Download the Elemetric app to access your individual account.'
            ),
          }
        }
      }
      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
