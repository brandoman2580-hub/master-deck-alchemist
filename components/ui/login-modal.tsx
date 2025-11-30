"use client"

import { useState } from "react"
import { SignupForm } from "./signup-form"
import { Dialog, DialogContent, DialogTitle } from "./dialog"
import { useLoginModalStore } from "../../store/useLoginModalStore"
import { LoginForm } from "./login-form"

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
