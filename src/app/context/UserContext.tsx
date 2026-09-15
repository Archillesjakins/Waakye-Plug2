'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/app/lib/supabase'

type UserContextType = {
  userId: string           // Supabase auth uid — this is profiles.id / orders.customer_id
  username: string
  phone: string
  setUser: (username: string, phone: string) => Promise<void>
  hasUser: boolean
  ready: boolean            // true once the anonymous session + profile lookup finish
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [ready, setReady] = useState(false)

  // Resolve (or create) an anonymous Supabase Auth session on first load —
  // Supabase's client persists that session in the browser on its own, so
  // this replaces the old hand-rolled localStorage id entirely. Then load
  // any existing profile tied to that session.
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        let uid = ''

        // A stored session whose refresh token is stale (rotated away, anon key
        // changed, database reset) makes getSession() REJECT with AuthApiError
        // instead of returning null — that rejection used to kill init() before
        // ready ever flipped, leaving the app stuck on the boot spinner. Clear
        // the dead session and fall through to a fresh anonymous sign-in.
        try {
          const { data } = await supabase.auth.getSession()
          uid = data.session?.user?.id ?? ''
        } catch (sessionErr) {
          console.warn('Stored session unusable — clearing it and starting fresh', sessionErr)
          await supabase.auth.signOut().catch(() => {})
        }

        if (!uid) {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) {
            console.error('Anonymous sign-in failed', error)
            return // finally still flips ready — app renders as guest
          }
          uid = data.user?.id ?? ''
        }

        if (!uid) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', uid)
          .maybeSingle()

        if (!cancelled) {
          setUserId(uid)
          setUsername(profile?.full_name ?? '')
          setPhone(profile?.phone ?? '')
        }
      } catch (initErr) {
        // Last resort: never leave the app stuck on the boot spinner.
        console.error('Auth init failed — continuing as guest', initErr)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function setUser(name: string, phoneNumber: string) {
    if (!userId) return
    const trimmedName = name.trim()

    // profiles.email is NOT NULL + UNIQUE; anonymous auth users don't have
    // a real email, so use a synthetic one tied to their auth id.
    const syntheticEmail = `${userId}@customers.waakyeplug.app`

    // Two paths, NO upsert: PostgREST upserts require UPDATE privileges on
    // every payload column even when the row doesn't exist yet, and our RLS
    // lockdown only grants UPDATE on full_name/phone (so nobody can rewrite
    // their own role/email). First save = INSERT (RLS forces role='customer'
    // via the column default), later saves = targeted UPDATE.
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    const { error } = existing
      ? await supabase
          .from('profiles')
          .update({ full_name: trimmedName, phone: phoneNumber })
          .eq('id', userId)
      : await supabase.from('profiles').insert({
          id: userId,
          full_name: trimmedName,
          phone: phoneNumber,
          email: syntheticEmail,
        })

    if (error) {
      console.error('Could not save profile', error)
      throw error // surface to the screen so the user sees the failure
    }

    setUsername(trimmedName)
    setPhone(phoneNumber)
  }

  const hasUser = username.trim().length > 0 && phone.trim().length > 0

  return (
    <UserContext.Provider value={{ userId, username, phone, setUser, hasUser, ready }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>')
  return ctx
}