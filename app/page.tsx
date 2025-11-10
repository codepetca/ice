"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Home() {
  const { showToast } = useToast();
  const [code, setCode] = useState(["", "", "", ""]);
  const [validating, setValidating] = useState(false);
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullCode = code.join("");
  const room = useQuery(
    api.rooms.getRoom,
    fullCode.length === 4 ? { code: fullCode } : "skip"
  );

  // Autofocus on first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-focus first empty box when user starts typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if any input has focus
      const anyInputFocused = inputRefs.current.some(
        (input) => input === document.activeElement
      );

      // If no input is focused and user types a valid letter
      if (!anyInputFocused && /^[A-Z]$/i.test(e.key)) {
        // Find first empty box
        const firstEmptyIndex = code.findIndex((c) => c === "");
        const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
        inputRefs.current[targetIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [code]);

  // Auto-advance when all 4 letters entered and room exists
  useEffect(() => {
    if (fullCode.length === 4 && room !== undefined && !validating) {
      if (room) {
        // Room exists, show loading state then navigate
        setValidating(true);
        router.push(`/user?roomCode=${fullCode}`);
      } else {
        // Room doesn't exist, show error and reset
        setValidating(true);
        showToast("Room not found - please check the code", "error");
        setTimeout(() => {
          setCode(["", "", "", ""]);
          setValidating(false);
          inputRefs.current[0]?.focus();
        }, 1500);
      }
    }
  }, [fullCode, room, router, validating, showToast]);

  const handleInputChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    // Allow any non-whitespace character
    const validChars = upperValue.replace(/\s/g, "");

    if (validChars.length > 0) {
      const newCode = [...code];
      newCode[index] = validChars[0]; // Take only first character
      setCode(newCode);

      // Auto-focus next input
      if (index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (code[index] === "" && index > 0) {
        // If current box is empty, go back and clear previous
        const newCode = [...code];
        newCode[index - 1] = "";
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current box
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      }
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").toUpperCase();
    const validChars = pastedText.replace(/\s/g, ""); // Remove whitespace

    const newCode = [...code];
    for (let i = 0; i < Math.min(4, validChars.length); i++) {
      newCode[i] = validChars[i];
    }
    setCode(newCode);

    // Focus appropriate input
    const nextEmpty = newCode.findIndex(c => c === "");
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus();
    } else {
      inputRefs.current[2]?.focus();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-12"
      >
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-6xl font-display font-bold text-foreground tracking-tight">
            Ice
          </h1>
        </div>

        {/* Code Input Boxes */}
        <div className="space-y-4">
          <p className="text-center text-sm font-sans text-muted-foreground uppercase tracking-wide">Enter room code</p>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                value={code[index]}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                maxLength={1}
                disabled={validating || (fullCode.length === 4 && room === undefined)}
                className="w-20 h-24 text-center text-5xl font-display font-bold border-2 border-border rounded-lg bg-primary text-primary-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all uppercase disabled:opacity-50"
              />
            ))}
          </div>

          {/* Loading indicator */}
          {(validating || (fullCode.length === 4 && room === undefined)) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center"
            >
              <LoadingSpinner size="sm" />
            </motion.div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
