"use client"

import { useState } from "react"
import { SignupForm } from "./signup-form.tsx"
import { Dialog, DialogContent, DialogTitle } from "./dialog.tsx"
import { useLoginModalStore } from "../../store/useLoginModalStore.ts"
import { LoginForm } from "./login-form.tsx"

export function LoginModal() {
  const { isOpen, closeLoginModal } = useLoginModalStore()
  const [showSignup, setShowSignup] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={closeLoginModal}>
      <DialogContent className="max-w-md w-full">
        <DialogTitle>
          {showSignup ? "Sign Up for Master Deck Alchemist" : "Login to Master Deck Alchemist"}
        </DialogTitle>
        {showSignup ? (
          <SignupForm onBack={() => setShowSignup(false)} />
        ) : (
          <LoginForm onSignupClick={() => setShowSignup(true)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
