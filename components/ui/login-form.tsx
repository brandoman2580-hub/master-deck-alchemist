"use client";

import { useState } from "react";
import type { FormEvent } from "react";
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
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  return (
    <div className="space-y-6 w-full max-w-sm mx-auto">
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
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError("Please enter your email address first");
                  setSuccess(null);
                  return;
                }
                setResetting(true);
                setError(null);
                setSuccess(null);
                try {
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/reset-password`,
                  });
                  if (resetError) {
                    setError(resetError.message);
                    setSuccess(null);
                  } else {
                    setError(null);
                    setSuccess("Password reset email sent! Please check your inbox.");
                  }
                } catch (err) {
                  setError("Failed to send password reset email");
                  setSuccess(null);
                } finally {
                  setResetting(false);
                }
              }}
              disabled={resetting}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? "Sending..." : "Forgot password?"}
            </button>
          </div>
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
        {success && (
          <div
            role="alert"
            aria-live="polite"
            className="text-green-600 text-sm"
          >
            {success}
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
