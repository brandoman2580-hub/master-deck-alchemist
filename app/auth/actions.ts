"use server";

import { redirect } from "next/navigation";

import { createClient } from "../../utils/supabase/server";
import type { SignupFormState } from "@/types/auth";
import process from "node:process";

/**
 * Email/password signup server action used by landing + signup form.
 * On failure redirects to `/error?code=auth-signup-failed`.
 */
export async function signup(
  prevState: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const supabase = await createClient();
  if (!formData) return prevState;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error) {
    redirect("/error?code=auth-signup-failed");
  }

  return { success: true, email };
}
