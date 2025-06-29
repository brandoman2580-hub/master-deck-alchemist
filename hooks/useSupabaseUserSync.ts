import { useEffect } from "react"
import { useUserStore } from "@/store/useUserStore"
import { supabase } from "@/lib/supabaseClient"

export function useSupabaseUserSync() {
  const setUser = useUserStore((state) => state.setUser)

  useEffect(() => {
    // Get current user on mount
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [setUser])
}
