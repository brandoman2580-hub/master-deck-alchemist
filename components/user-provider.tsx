'use client'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useUserStore } from '../store/useUserStore.ts'
import { supabase } from '../lib/supabaseClient.ts'

export function UserProvider({ children }: { children: ReactNode }) {
  const setUser = useUserStore((state) => state.setUser)

  useEffect(() => {
    // Initial fetch
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [setUser])

  return <>{children}</>
}