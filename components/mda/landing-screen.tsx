"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/app/auth/actions";
import { createClient } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import { landingMarkup } from "./landing-markup";
import { startLandingMotion } from "./landing-motion";

const supabase = createClient();

const scriptLoads = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const pending = scriptLoads.get(src);
  if (pending) return pending;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        script.dataset.failed = "true";
        reject(new Error(`Failed to load ${src}`));
      },
      { once: true },
    );
    document.body.appendChild(script);
  });
  scriptLoads.set(src, promise);
  return promise;
}

/**
 * The Sticky Word Stack landing, rendered from the downloaded Stitch screen.
 * Login and account creation use the app's auth client.
 */
export function LandingScreen() {
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;

    const boot = async () => {
      if (process.env.NODE_ENV !== "test") {
        try {
          await loadScript("/vendor/gsap/gsap.min.js");
          await loadScript("/vendor/gsap/ScrollTrigger.min.js");
        } catch (error) {
          console.error(error);
        }
      }
      if (cancelled) return;
      stop = startLandingMotion(async (mode, email, password) => {
        const feedback = document.getElementById("authFeedback");
        if (feedback) feedback.textContent = "";
        if (mode === "reset") {
          if (!email) {
            if (feedback) feedback.textContent = "Enter your email address first.";
            return;
          }
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          });
          if (feedback) {
            feedback.textContent = error
              ? error.message
              : `Password reset email sent to ${email}.`;
          }
          return;
        }
        if (mode === "signup") {
          const formData = new FormData();
          formData.append("email", email);
          formData.append("password", password);
          try {
            const result = await signup({ success: false }, formData);
            if (!feedback) return;
            feedback.textContent = result.success
              ? `Confirmation email sent to ${result.email ?? email}. Check your inbox, then log in.`
              : (result.error ?? "Signup failed");
          } catch {
            if (feedback) feedback.textContent = "Signup failed";
          }
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user) {
          if (feedback) feedback.textContent = error?.message ?? "Login failed";
          return;
        }
        setUser(data.user);
        router.push("/deck-archives");
      });
    };

    void boot();
    return () => {
      cancelled = true;
      stop();
    };
  }, [router, setUser]);

  return (
    <div
      id="landing-root"
      className="min-h-screen bg-brandDark font-openSans text-slate-200 antialiased"
      dangerouslySetInnerHTML={{ __html: landingMarkup }}
    />
  );
}
