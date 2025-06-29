"use client";
import { useLoginModalStore } from "@/store/useLoginModalStore";

export default function ConfirmPage() {
  const { openLoginModal } = useLoginModalStore();

  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <h1 className="text-lg font-semibold text-green-600">Email confirmed!</h1>
      <p className="text-gray-700">
        Your email has been successfully confirmed. You can now log in.
      </p>
      <button
        onClick={openLoginModal}
        className="text-blue-600 underline mt-4 inline-block"
      >
        Open Login
      </button>
    </div>
  );
}