"use server";

import { createClient } from "../../utils/supabase/server";
import type { SignupFormState } from "@/types/auth";
import process from "node:process";

/**
 * Email/password signup server action used by the landing dialog.
 * Failures return `{ success: false, error }` so the dialog can show them.
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
    return { success: false, error: error.message };
  }

  return { success: true, email };
}
