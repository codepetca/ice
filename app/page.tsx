"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Home() {
  const [code, setCode] = useState(["", "", ""]);
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

      // If no input is focused and user types a valid consonant
      if (!anyInputFocused && /^[BCDFGHJKLMNPQRSTVWXYZ]$/i.test(e.key)) {
        // Find first empty box
        const firstEmptyIndex = code.findIndex((c) => c === "");
        const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
        inputRefs.current[targetIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [code]);

  // Auto-advance when all 3 letters entered
  useEffect(() => {
    const fullCode = code.join("");
    if (fullCode.length === 3) {
      // Navigate to user page with the code
      router.push(`/user?roomCode=${fullCode}`);
    }
  }, [code, router]);

  const handleInputChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    // Only allow consonants (no vowels)
    const consonantsOnly = upperValue.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, "");

    if (consonantsOnly.length > 0) {
      const newCode = [...code];
      newCode[index] = consonantsOnly[0]; // Take only first character
      setCode(newCode);

      // Auto-focus next input
      if (index < 2) {
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
    const consonantsOnly = pastedText.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, "");

    const newCode = [...code];
    for (let i = 0; i < Math.min(3, consonantsOnly.length); i++) {
      newCode[i] = consonantsOnly[i];
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
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Logo/Title */}
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold text-gray-900">Ice</h1>
        </div>

        {/* Code Input Boxes */}
        <div className="space-y-3">
          <p className="text-center text-lg text-gray-600">Enter room code</p>
          <div className="flex justify-center gap-4">
            {[0, 1, 2].map((index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                value={code[index]}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                maxLength={1}
                className="w-20 h-24 text-center text-5xl font-bold border-4 border-blue-300 rounded-2xl bg-blue-600 text-white placeholder-blue-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition uppercase"
              />
            ))}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
