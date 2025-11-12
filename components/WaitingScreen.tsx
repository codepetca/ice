"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface WaitingScreenProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
}

export function WaitingScreen({ children, title, subtitle }: WaitingScreenProps) {
  return (
    <div className="flex flex-col justify-center items-center min-h-[100vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 sm:space-y-8"
      >
        {title && (
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground">
            {title}
          </h2>
        )}

        {children}

        {subtitle && (
          <p className="text-lg sm:text-xl font-sans text-muted-foreground max-w-md mx-auto">
            {subtitle}
          </p>
        )}
      </motion.div>
    </div>
  );
}
