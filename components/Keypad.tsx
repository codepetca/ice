"use client";

import { motion } from "framer-motion";

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  allowDecimal?: boolean;
}

export function Keypad({ value, onChange, maxLength, allowDecimal = false }: KeypadProps) {
  const handlePress = (char: string) => {
    // For decimal point, check if already exists
    if (char === "." && (value.includes(".") || !allowDecimal)) {
      return;
    }

    if (value.length < maxLength || char === ".") {
      onChange(value + char);
    }
  };

  const handleBackspace = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const buttons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {buttons.slice(0, 9).map((digit) => (
          <motion.button
            key={digit}
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePress(digit)}
            className="aspect-square text-3xl font-display font-bold bg-card border-2 border-border rounded-lg hover:bg-muted hover:border-primary transition-all shadow-sm"
          >
            {digit}
          </motion.button>
        ))}
        {allowDecimal ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePress(".")}
            disabled={value.includes(".")}
            className="aspect-square text-3xl font-display font-bold bg-card border-2 border-border rounded-lg hover:bg-muted hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            .
          </motion.button>
        ) : (
          <div /> /* Empty space */
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePress("0")}
          className="aspect-square text-3xl font-display font-bold bg-card border-2 border-border rounded-lg hover:bg-muted hover:border-primary transition-all shadow-sm"
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleBackspace}
          disabled={value.length === 0}
          className="aspect-square text-2xl font-display font-bold bg-primary text-primary-foreground border-2 border-primary rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          ⌫
        </motion.button>
      </div>
    </div>
  );
}
