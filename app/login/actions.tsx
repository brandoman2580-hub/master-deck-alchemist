'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'
import { SignupFormState } from '../../types/types'
import process from "node:process";

type LoginResult = {
  success: boolean
  error?: string
}


export async function login(formData: FormData): Promise<LoginResult> {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(prevState: SignupFormState, formData: FormData) {
  const supabase = await createClient()
  if (!formData) return prevState;
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  })

  if (error) {
    redirect('/error?code=auth-signup-failed')
  }

  // Return success state instead of redirecting
  return { success: true, email }
}

function getRedirectTo() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectTo() }
  })
  if (error) redirect('/error')
}

export async function signInWithFacebook() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: getRedirectTo() }
  })
  if (error) redirect('/error')
}

export async function signInWithDiscord() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: getRedirectTo() }
  })
  if (error) redirect('/error')
}

export async function signInWithApple() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: getRedirectTo() }
  })
  if (error) redirect('/error')
}