"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Keypad } from "@/components/Keypad";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();

  // Auto-advance when 4 digits entered
  useEffect(() => {
    if (code.length === 4) {
      // Navigate to student page with the code
      router.push(`/student?classCode=${code}`);
    }
  }, [code, router]);

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
          <p className="text-lg text-gray-600">Enter class code</p>
        </div>

        {/* Code Display */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="w-16 h-20 flex items-center justify-center text-4xl font-bold border-2 border-gray-300 rounded-xl bg-white"
            >
              {code[index] || ""}
            </div>
          ))}
        </div>

        {/* Keypad */}
        <Keypad value={code} onChange={setCode} maxLength={4} />

        {/* Create New Session Link */}
        <div className="text-center pt-8">
          <a
            href="/teacher"
            className="text-sm text-gray-500 hover:text-gray-700 underline transition"
          >
            Create new session
          </a>
        </div>
      </motion.div>
    </main>
  );
}
