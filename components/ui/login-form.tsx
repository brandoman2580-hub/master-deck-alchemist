"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  signInWithGoogle,
  signInWithFacebook,
  signInWithDiscord,
  signInWithApple,
} from "../../app/login/actions";
import { useLoginModalStore } from "../../store/useLoginModalStore";
import { useUserStore } from "../../store/useUserStore";
import { supabase } from "../../lib/supabaseClient";
import CutCornerWrapper from "../cut-corner-wrapper";

type LoginFormProps = {
  onSignupClick: () => void;
};

export function LoginForm({ onSignupClick }: LoginFormProps) {
  const { setUser } = useUserStore.getState()
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { closeLoginModal } = useLoginModalStore();

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  setSubmitting(true)
  const formData = new FormData()
  formData.append("email", email)
  formData.append("password", password)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  setSubmitting(false)
  if (!error && data?.user) {
    setUser(data.user) // Update Zustand immediately!
    closeLoginModal()
  } else {
    setError(error?.message || "Login failed")
  }
}

  // @TODO: Add social login buttons when backend is ready
  return (
    <div className="space-y-6 w-full max-w-sm mx-auto">
      {/* Social Login Buttons */}
      <form action={signInWithGoogle}>
        <CutCornerWrapper
          size="sm"
          padding="0"
          className="w-full mb-2"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-fill" as any]: "transparent",
          }}
        >
          <button
            disabled
            type="submit"
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Google
          </button>
        </CutCornerWrapper>
      </form>
      <form action={signInWithFacebook}>
        <CutCornerWrapper
          size="sm"
          padding="0"
          className="w-full mb-2"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-fill" as any]: "transparent",
          }}
        >
          <button
            disabled
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Facebook
          </button>
        </CutCornerWrapper>
      </form>
      <form action={signInWithDiscord}>
        <CutCornerWrapper
          size="sm"
          padding="0"
          className="w-full mb-2"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-fill" as any]: "transparent",
          }}
        >
          <button
            disabled
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Discord
          </button>
        </CutCornerWrapper>
      </form>
      <form action={signInWithApple}>
        <CutCornerWrapper
          size="sm"
          padding="0"
          className="w-full mb-2"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-fill" as any]: "transparent",
          }}
        >
          <button
            disabled
            type="submit"
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Apple
          </button>
        </CutCornerWrapper>
      </form>

      <div className="flex items-center my-4">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-2 text-gray-400 text-xs">or</span>
        <div className="flex-grow border-t border-gray-200" />
      </div>

      {/* Email/Password Login */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <CutCornerWrapper
            size="sm"
            padding="0"
            className="w-full"
            style={{
              ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
              ["--cut-corner-fill" as any]: "transparent",
            }}
          >
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </CutCornerWrapper>
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <CutCornerWrapper
            size="sm"
            padding="0"
            className="w-full"
            style={{
              ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
              ["--cut-corner-fill" as any]: "transparent",
            }}
          >
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </CutCornerWrapper>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <CutCornerWrapper
          size="sm"
          padding="0"
          className="w-full"
          style={{
            ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
            ["--cut-corner-fill" as any]: "transparent",
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 transition"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </CutCornerWrapper>
      </form>

      {/* Sign Up Link */}
      <div className="text-center mt-2 text-sm">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={onSignupClick}
        >
          Sign up with Email
        </button>
      </div>
    </div>
  );
}
