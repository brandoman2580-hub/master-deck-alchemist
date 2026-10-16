"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { ClipButton } from "@/components/mda/clip-button";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup";

const authFieldClass =
  "mda-auth-field group flex h-12 items-center gap-2.5 rounded bg-mda-chrome px-[18px] ring-1 ring-transparent transition-[background-color,box-shadow,ring-color] duration-200 ease-in-out hover:bg-mda-chrome-muted hover:ring-mda-cyan-soft/50 focus-within:bg-mda-chrome-muted focus-within:ring-mda-cyan";

/**
 * Doors open reveal — recreates Motion Curtains: Doors "open" phase
 * scoped to the modal.
 */
function DoorReveal({
  children,
  reduceMotion,
}: {
  children: ReactNode;
  reduceMotion: boolean | null;
}): ReactNode {
  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      className="relative overflow-hidden"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{
        open: {
          transition: {
            staggerChildren: 0,
            delayChildren: 0.02,
          },
        },
        closed: {
          transition: {
            staggerChildren: 0,
            staggerDirection: -1,
          },
        },
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/2 bg-mda-chrome"
        variants={{
          closed: { x: "0%" },
          open: { x: "-100%" },
        }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1/2 bg-mda-chrome"
        variants={{
          closed: { x: "0%" },
          open: { x: "100%" },
        }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  );
}

function isAutofilled(el: HTMLInputElement | null): boolean {
  if (!el) return false;
  if (el.value.trim().length > 0) return true;
  try {
    return el.matches(":-webkit-autofill");
  } catch {
    return false;
  }
}

export type LandingAuthModalProps = {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  email: string;
  password: string;
  confirm: string;
  showPassword: boolean;
  remember: boolean;
  error: string | null;
  message: string | null;
  submitting: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onShowPasswordToggle: () => void;
  onRememberChange: (value: boolean) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onSignup: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
};

export function LandingAuthModal({
  open,
  mode,
  onModeChange,
  onClose,
  email,
  password,
  confirm,
  showPassword,
  remember,
  error,
  message,
  submitting,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onShowPasswordToggle,
  onRememberChange,
  onLogin,
  onSignup,
  onForgotPassword,
}: LandingAuthModalProps): ReactNode {
  const reduceMotion = useReducedMotion();
  const [direction, setDirection] = useState(1);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const goSignup = (): void => {
    setDirection(1);
    onModeChange("signup");
  };

  const goLogin = (): void => {
    setDirection(-1);
    onModeChange("login");
  };

  // Focus email only when login fields are not already autofilled
  // (Remember Me / browser password manager). Autofill often lands after
  // first paint, so re-check a few times and blur if values appear.
  useEffect(() => {
    if (!open || mode !== "login") return;

    let cancelled = false;
    let focusedEmpty = false;

    const syncFocus = (): void => {
      if (cancelled) return;
      const emailFilled = isAutofilled(emailRef.current);
      const passwordFilled = isAutofilled(passwordRef.current);
      if (emailFilled || passwordFilled) {
        emailRef.current?.blur();
        passwordRef.current?.blur();
        focusedEmpty = false;
        return;
      }
      if (!focusedEmpty) {
        emailRef.current?.focus({ preventScroll: true });
        focusedEmpty = true;
      }
    };

    const t0 = window.setTimeout(syncFocus, 50);
    const t1 = window.setTimeout(syncFocus, 200);
    const t2 = window.setTimeout(syncFocus, 450);

    const onAnimationStart = (event: AnimationEvent): void => {
      if (event.animationName === "onAutoFillStart") syncFocus();
    };
    document.addEventListener("animationstart", onAnimationStart, true);

    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      document.removeEventListener("animationstart", onAnimationStart, true);
    };
  }, [open, mode]);

  const slideVariants = {
    enter: (dir: number) =>
      reduceMotion
        ? { opacity: 0 }
        : { x: dir > 0 ? "60%" : "-60%", opacity: 0 },
    center: { x: "0%", opacity: 1 },
    exit: (dir: number) =>
      reduceMotion
        ? { opacity: 0 }
        : { x: dir > 0 ? "-60%" : "60%", opacity: 0 },
  };

  const isSignup = mode === "signup";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="auth-backdrop"
          className="fixed inset-0 z-40 flex items-center justify-center bg-mda-ink/35 p-4"
          role="presentation"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            className="relative w-full max-w-[420px] overflow-hidden rounded-sm bg-mda-panel shadow-mda-lift"
            onClick={(event) => event.stopPropagation()}
            initial={reduceMotion ? { opacity: 0 } : "closed"}
            animate={reduceMotion ? { opacity: 1 } : "open"}
            exit={reduceMotion ? { opacity: 0 } : "closed"}
            variants={{
              closed: {
                opacity: 0,
                transition: { delay: 0.28, duration: 0.15 },
              },
              open: { opacity: 1 },
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <DoorReveal reduceMotion={reduceMotion}>
              <div className="flex flex-col items-center gap-2.5 p-6">
                <Lock className="h-12 w-12 text-mda-ink" aria-hidden />

                <div className="relative w-full overflow-hidden">
                  <AnimatePresence
                    mode="popLayout"
                    custom={direction}
                    initial={false}
                  >
                    <motion.div
                      key={mode}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 34,
                        mass: 0.7,
                      }}
                      className="flex w-full flex-col items-center gap-2.5"
                    >
                      <h2
                        id="auth-dialog-title"
                        className="px-2 py-2 text-center font-display text-2xl font-black uppercase tracking-wide text-mda-ink sm:text-[32px]"
                      >
                        {isSignup
                          ? "Create Account"
                          : "Authentication Required"}
                      </h2>

                      <form
                        onSubmit={isSignup ? onSignup : onLogin}
                        className="flex w-full flex-col gap-4 px-1"
                        autoComplete={isSignup ? "off" : "on"}
                      >
                        <label className={authFieldClass}>
                          <Mail
                            className="h-6 w-6 shrink-0 text-mda-inverse-text"
                            aria-hidden
                          />
                          <input
                            ref={emailRef}
                            type="email"
                            required
                            name={isSignup ? "mda-signup-email" : "email"}
                            autoComplete={isSignup ? "off" : "email"}
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore={isSignup ? "true" : undefined}
                            data-lpignore={isSignup ? "true" : undefined}
                            value={email}
                            onChange={(event) =>
                              onEmailChange(event.target.value)
                            }
                            placeholder="Email"
                            className="w-full bg-transparent font-display text-base text-mda-inverse-text placeholder:text-mda-inverse-text/70 focus:outline-none"
                          />
                        </label>

                        <label
                          className={cn(authFieldClass, "justify-between")}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2.5">
                            <KeyRound
                              className="h-6 w-6 shrink-0 text-mda-inverse-text"
                              aria-hidden
                            />
                            <input
                              ref={passwordRef}
                              type={showPassword ? "text" : "password"}
                              required
                              name={
                                isSignup ? "mda-signup-password" : "password"
                              }
                              autoComplete={
                                isSignup ? "new-password" : "current-password"
                              }
                              data-1p-ignore={isSignup ? "true" : undefined}
                              data-lpignore={isSignup ? "true" : undefined}
                              value={password}
                              onChange={(event) =>
                                onPasswordChange(event.target.value)
                              }
                              placeholder="Password"
                              className="w-full bg-transparent font-display text-base text-mda-inverse-text placeholder:text-mda-inverse-text/70 focus:outline-none"
                            />
                          </span>
                          {!isSignup ? (
                            <button
                              type="button"
                              onClick={onShowPasswordToggle}
                              aria-label={
                                showPassword
                                  ? "Hide password"
                                  : "Show password"
                              }
                              className="shrink-0 text-mda-inverse-text transition-colors duration-200 hover:text-mda-inverse-text"
                            >
                              {showPassword ? (
                                <EyeOff className="h-6 w-6" aria-hidden />
                              ) : (
                                <Eye className="h-6 w-6" aria-hidden />
                              )}
                            </button>
                          ) : null}
                        </label>

                        {isSignup ? (
                          <label className={authFieldClass}>
                            <KeyRound
                              className="h-6 w-6 shrink-0 text-mda-inverse-text"
                              aria-hidden
                            />
                            <input
                              type="password"
                              required
                              name="mda-signup-confirm"
                              autoComplete="new-password"
                              data-1p-ignore="true"
                              data-lpignore="true"
                              value={confirm}
                              onChange={(event) =>
                                onConfirmChange(event.target.value)
                              }
                              placeholder="Retype Password"
                              className="w-full bg-transparent font-display text-base text-mda-inverse-text placeholder:text-mda-inverse-text/70 focus:outline-none"
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between gap-4 font-mda text-sm">
                            <label className="flex items-center gap-2.5 text-mda-ink">
                              <input
                                type="checkbox"
                                checked={remember}
                                onChange={(event) =>
                                  onRememberChange(event.target.checked)
                                }
                                className="size-3.5 border border-mda-ink/40 accent-mda-cyan"
                              />
                              Remember Me
                            </label>
                            <button
                              type="button"
                              onClick={onForgotPassword}
                              className="inline-flex min-h-11 items-center text-mda-cyan underline underline-offset-2 hover:text-mda-sky-strong"
                            >
                              Forgot Password?
                            </button>
                          </div>
                        )}

                        {error ? (
                          <p
                            className="font-mda text-sm text-mda-danger"
                            role="alert"
                          >
                            {error}
                          </p>
                        ) : null}
                        {message ? (
                          <p className="font-mda text-sm text-mda-success">
                            {message}
                          </p>
                        ) : null}

                        <ClipButton
                          type="submit"
                          size="lg"
                          variant="authSubmit"
                          disabled={submitting}
                          className={cn(
                            "w-full min-w-0 whitespace-nowrap",
                            isSignup ? "text-xl sm:text-2xl" : "text-[32px]",
                          )}
                        >
                          {isSignup ? "Create Account" : "Login"}
                        </ClipButton>

                        {!isSignup ? (
                          <>
                            <div
                              className="h-px w-full bg-mda-ink/25"
                              aria-hidden
                            />
                            <p className="text-center font-mda text-sm text-mda-ink-muted">
                              Don&apos;t have an account?{" "}
                              <button
                                type="button"
                                onClick={goSignup}
                                className="inline-flex min-h-11 items-center text-mda-cyan underline underline-offset-2 hover:text-mda-sky-strong"
                              >
                                Create one
                              </button>
                            </p>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={goLogin}
                            className="text-center font-mda text-sm text-mda-cyan underline underline-offset-2 hover:text-mda-sky-strong"
                          >
                            Back to login
                          </button>
                        )}
                      </form>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </DoorReveal>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
