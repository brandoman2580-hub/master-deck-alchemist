"use client"

import { useUserStore } from "@/store/useUserStore"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

function getInitials(user: { user_metadata?: { name?: string }; email?: string } | null) {
  if (!user) return "U"
  const name = user.user_metadata?.name as string | undefined
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }
  if (user.email) return user.email[0].toUpperCase()
  return "U"
}

export function UserMenu() {
  const user = useUserStore((state) => state.user)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [dropdownOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setDropdownOpen(false)
    window.location.reload()
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="w-10 h-10 rounded-full bg-blue-200 text-blue-900 font-bold flex items-center justify-center"
        aria-label="User menu"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        {getInitials(user)}
      </button>
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-50 py-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-400 cursor-not-allowed"
            startIcon={<HelpCircle className="mr-2" />}
            disabled
          >
            Help
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-black hover:bg-gray-500"
            startIcon={<LogOut className="mr-2" />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      )}
    </div>
  )
}
