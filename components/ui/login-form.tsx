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

type LoginFormProps = {
  onSignupClick: () => void;
};

export function LoginForm({ onSignupClick }: LoginFormProps) {
  const { setUser } = useUserStore.getState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { closeLoginModal } = useLoginModalStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmitting(false);
    if (!error && data?.user) {
      setUser(data.user); // Update Zustand immediately!
      closeLoginModal();
    } else {
      setError(error?.message || "Login failed");
    }
  };

  // @TODO: Add social login buttons when backend is ready
  return (
    <div className="space-y-6 w-full max-w-sm mx-auto">
      {/* Social Login Buttons */}
      <form action={signInWithGoogle}>
        <div className="w-full mb-2 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
          <button
            disabled
            type="submit"
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Google
          </button>
        </div>
      </form>
      <form action={signInWithFacebook}>
        <div className="w-full mb-2 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
          <button
            disabled
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Facebook
          </button>
        </div>
      </form>
      <form action={signInWithDiscord}>
        <div className="w-full mb-2 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
          <button
            disabled
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Discord
          </button>
        </div>
      </form>
      <form action={signInWithApple}>
        <div className="w-full mb-2 bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
          <button
            disabled
            type="submit"
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-2 transition cursor-not-allowed"
          >
            Continue with Apple
          </button>
        </div>
      </form>

      <div className="flex items-center my-4">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-2 text-slate-300 text-xs">or</span>
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
          <div className="w-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-required="true"
              aria-invalid={!!error}
              aria-describedby={error ? "login-email-error" : undefined}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <div className="w-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-required="true"
              aria-invalid={!!error}
              aria-describedby={error ? "login-password-error" : undefined}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none"
            />
          </div>
        </div>
        {error && (
          <div
            id="login-email-error"
            role="alert"
            aria-live="polite"
            className="text-red-600 text-sm"
          >
            {error}
          </div>
        )}
        <div className="w-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-lg">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 transition"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </div>
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
