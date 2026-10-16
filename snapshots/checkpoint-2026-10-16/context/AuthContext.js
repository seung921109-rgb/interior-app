"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const AuthContext = createContext(null)
const DEFAULT_FREE_COUNT = 3
const LOCAL_FREE_KEY = "interior-app:free_count"

function readLocalCredits() {
  if (typeof window === "undefined") return DEFAULT_FREE_COUNT
  const raw = window.localStorage.getItem(LOCAL_FREE_KEY)
  if (raw == null || raw === "") return DEFAULT_FREE_COUNT
  const value = Number(raw)
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_FREE_COUNT
}

function writeLocalCredits(value) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOCAL_FREE_KEY, String(Math.max(0, value)))
}

export function AuthProvider({ children }) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [credits, setCredits] = useState(DEFAULT_FREE_COUNT)
  const [loading, setLoading] = useState(Boolean(supabase))

  function setRemaining(value) {
    const next = Math.max(0, Number(value) || 0)
    setCredits(next)
    if (!user) writeLocalCredits(next)
    return next
  }

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
    if (typeof next?.free_count === "number") setRemaining(next.free_count)
    return next
  }

  useEffect(() => {
    setCredits(readLocalCredits())
  }, [])

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
        const row = await loadProfile(supabase, nextUser.id)
        if (!active) return
        setProfile(row)
        if (typeof row?.free_count === "number") setCredits(row.free_count)
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
        setCredits(readLocalCredits())
        setLoading(false)
        return
      }
      loadProfile(supabase, nextUser.id).then((row) => {
        setProfile(row)
        if (typeof row?.free_count === "number") setCredits(row.free_count)
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
      remaining: credits,
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
        if (supabase) await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setCredits(readLocalCredits())
      },
      async consumeFreeCount() {
        if (credits <= 0) return { ok: false, remaining: 0, reason: "empty" }

        if (supabase && user) {
          const { data, error } = await supabase.rpc("consume_free_count")
          if (!error && typeof data === "number") {
            if (data < 0) {
              setRemaining(0)
              return { ok: false, remaining: 0, reason: "empty" }
            }
            setProfile((prev) => (prev ? { ...prev, free_count: data } : prev))
            setRemaining(data)
            return { ok: true, remaining: data }
          }
          console.warn("consume_free_count failed", error)
        }

        const remaining = setRemaining(credits - 1)
        if (supabase && user) {
          await supabase
            .from("profiles")
            .update({ free_count: remaining })
            .eq("id", user.id)
        }
        return { ok: true, remaining }
      },
      refreshProfile,
    }),
    [supabase, loading, user, profile, credits],
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
