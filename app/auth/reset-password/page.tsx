"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MdaAppHeader } from "@/components/mda/app-header";
import { ClipButton } from "@/components/mda/clip-button";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage(): ReactNode {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Redirecting…");
    setTimeout(() => router.push("/deck-archives"), 1200);
  };

  return (
    <div className="min-h-screen bg-[color:var(--mda-bg)] text-white">
      <MdaAppHeader onLoginClick={() => router.push("/")} />
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-6 font-mda text-3xl font-bold uppercase">
          Reset Password
        </h1>
        {!ready ? (
          <p className="font-mda text-white/70">
            Open the reset link from your email to continue.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="w-full bg-[color:var(--mda-cyan-muted)] px-4 py-3 font-mda text-white placeholder:text-white/50 focus:outline-none"
            />
            <input
              type="password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Confirm password"
              className="w-full bg-[color:var(--mda-cyan-muted)] px-4 py-3 font-mda text-white placeholder:text-white/50 focus:outline-none"
            />
            {error ? (
              <p className="font-mda text-sm text-[color:var(--mda-danger)]" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="font-mda text-sm text-[color:var(--mda-success)]">{message}</p>
            ) : null}
            <ClipButton type="submit" className="w-full">
              Update Password
            </ClipButton>
          </form>
        )}
      </div>
    </div>
  );
}
