"use client";

import { motion } from "framer-motion";

interface AvatarDisplayProps {
  avatar: string;
  size?: "sm" | "md" | "lg" | "xl";
  withHalo?: boolean;
}

export function AvatarDisplay({
  avatar,
  size = "lg",
  withHalo = true
}: AvatarDisplayProps) {
  const sizeClasses = {
    sm: "text-6xl",
    md: "text-7xl",
    lg: "text-8xl",
    xl: "text-9xl",
  };

  const haloSizeClasses = {
    sm: "w-32 h-32",
    md: "w-40 h-40",
    lg: "w-48 h-48",
    xl: "w-56 h-56",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex items-center justify-center"
    >
      {withHalo ? (
        <div className={`${haloSizeClasses[size]} rounded-full bg-gradient-to-br from-primary-100/50 to-accent-100/50 dark:from-primary-900/30 dark:to-accent-900/30 border-2 border-primary-200/60 dark:border-primary-700/40 flex items-center justify-center shadow-lg`}>
          <div className={sizeClasses[size]}>{avatar}</div>
        </div>
      ) : (
        <div className={sizeClasses[size]}>{avatar}</div>
      )}
    </motion.div>
  );
}
