"use client";

import { useState } from "react";
import { SignupForm } from "./signup-form";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { useLoginModalStore } from "../../store/useLoginModalStore";
import { LoginForm } from "./login-form";

export function LoginModal() {
  const { isOpen, closeLoginModal } = useLoginModalStore();
  const [showSignup, setShowSignup] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={closeLoginModal}>
      <DialogContent className="max-w-md w-full">
        <DialogTitle className="pb-4">
            <>
              {showSignup ? "Sign Up for " : "Login to "}
              <span className="font-['Orbitron'] font-normal not-italic text-primary">
                Master Deck Alchemist
              </span>
            </>
        </DialogTitle>
        {showSignup ? (
          <SignupForm onBack={() => setShowSignup(false)} />
        ) : (
          <LoginForm onSignupClick={() => setShowSignup(true)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
