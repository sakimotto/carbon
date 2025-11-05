"use client";

import { useChatActions } from "@ai-sdk-tools/store";
import { useNavigate } from "@remix-run/react";
import { LuArrowLeft } from "react-icons/lu";
import { useChatInterface } from "./hooks/useChatInterface";

export function ChatNavigation() {
  const navigate = useNavigate();
  const { reset } = useChatActions();
  const { isHome } = useChatInterface();

  const handleBack = () => {
    reset();
    navigate(-1);
  };

  if (isHome) return null;

  return (
    <div className="absolute left-4">
      <button
        type="button"
        onClick={handleBack}
        className="p-2 hover:bg-accent transition-colors"
        aria-label="Back to home"
      >
        <LuArrowLeft className="w-4 h-4" />
      </button>
    </div>
  );
}
