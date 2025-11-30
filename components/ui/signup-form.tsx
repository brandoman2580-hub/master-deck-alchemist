"use client"
import { useState } from "react"
import { useActionState } from "react"
import { signup } from "../../app/login/actions.tsx"
import { SignupFormState } from "../../types/types.ts"

const initialState: SignupFormState = { success: false }

function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\.[^@]+$/.test(email)
}

function getPasswordRequirements(password: string) {
  return [
    { label: "At least 12 characters", valid: password.length >= 12 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "Lowercase letter", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /\d/.test(password) },
    { label: "Symbol", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]
}

export function SignupForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false })

  const [formState, formAction, isPending] = useActionState(signup, initialState)

  // Validation checks
  const emailValid = validateEmail(email)
  const passwordReqs = getPasswordRequirements(password)
  const passwordStrong = passwordReqs.every(r => r.valid)
  const passwordsMatch = password === confirm && password.length > 0

  // Only enable sign up if all conditions are met
  const canSignUp = emailValid && passwordStrong && passwordsMatch && !isPending

  // Feedback helpers
  const showEmailFeedback = touched.email && !emailValid
  const showPasswordFeedback = touched.password && !passwordStrong
  const showConfirmFeedback = touched.confirm && !passwordsMatch

  if (formState.success) {
    return (
      <div className="space-y-6 w-full max-w-sm mx-auto">
        <div className="text-lg font-semibold text-green-600">
          Success! 🎉
        </div>
        <div className="text-gray-700">
          A confirmation email has been sent to <span className="font-medium">{formState.email || email}</span>.
        </div>
        <div className="text-gray-600 text-sm">
          Please check your inbox and follow the instructions to confirm your account.
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6 w-full max-w-sm mx-auto">
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, email: true }))}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showEmailFeedback && (
          <div className="text-xs text-red-600 mt-1">Please enter a valid email address.</div>
        )}
      </div>
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, password: true }))}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ul className="mt-2 space-y-0.5 text-xs">
          {passwordReqs.map((req, i) => (
            <li key={i} className={req.valid ? "text-green-600" : "text-gray-500"}>
              {req.valid ? "✓" : "✗"} {req.label}
            </li>
          ))}
        </ul>
        {showPasswordFeedback && (
          <div className="text-xs text-red-600 mt-1">Password does not meet all requirements.</div>
        )}
      </div>
      <div>
        <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="signup-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showConfirmFeedback && (
          <div className="text-xs text-red-600 mt-1">Passwords do not match.</div>
        )}
      </div>
      {(formState.error) && (
        <div className="text-red-600 text-sm">{formState.error}</div>
      )}
      <button
        type="submit"
        disabled={!canSignUp}
        className={`w-full font-semibold py-2 rounded-md transition ${
          canSignUp
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isPending ? "Signing up..." : "Sign up"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm underline"
      >
        Back to login
      </button>
    </form>
  )
}
