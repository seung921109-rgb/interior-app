"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  async function loadProfile(client, userId) {
    const { data, error } = await client
      .from("profiles")
      .select("id, email, display_name, avatar_url, provider, free_count")
      .eq("id", userId)
      .maybeSingle()
    if (error) {
      console.warn("profile load failed", error)
      return null
    }
    return data
  }

  async function refreshProfile() {
    if (!supabase || !user) return null
    const next = await loadProfile(supabase, user.id)
    setProfile(next)
    return next
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let active = true

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      const nextUser = data.user ?? null
      setUser(nextUser)
      if (nextUser) {
        setProfile(await loadProfile(supabase, nextUser.id))
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }
      loadProfile(supabase, nextUser.id).then((row) => {
        setProfile(row)
        setLoading(false)
      })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const api = useMemo(
    () => ({
      configured: Boolean(supabase),
      loading,
      user,
      profile,
      remaining: profile?.free_count ?? null,
      async signInWithKakao() {
        if (!supabase) {
          throw new Error("Supabase 환경 변수가 없습니다.")
        }
        const origin = window.location.origin
        const next = `${window.location.pathname}${window.location.search}`
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next || "/")}`,
          },
        })
        if (error) throw error
      },
      async signOut() {
        if (!supabase) return
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
      },
      async consumeFreeCount() {
        if (!supabase || !user) return { ok: false, remaining: -1, reason: "auth" }
        const { data, error } = await supabase.rpc("consume_free_count")
        if (error) {
          console.warn("consume_free_count failed", error)
          return { ok: false, remaining: profile?.free_count ?? -1, reason: "error" }
        }
        const remaining = typeof data === "number" ? data : -1
        if (remaining < 0) {
          return { ok: false, remaining: 0, reason: "empty" }
        }
        setProfile((prev) => (prev ? { ...prev, free_count: remaining } : prev))
        return { ok: true, remaining }
      },
      refreshProfile,
    }),
    [supabase, loading, user, profile],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return value
}
