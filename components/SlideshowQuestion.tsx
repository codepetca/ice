"use client";

import { motion } from "framer-motion";

interface SlideshowQuestionProps {
  questionText: string;
  optionA: string;
  optionB: string;
  percentA: number;
  percentB: number;
  totalResponses: number;
  isRevealed: boolean;
  roundNumber: number;
  variant?: "projector" | "user" | "admin";
}

export function SlideshowQuestion({
  questionText,
  optionA,
  optionB,
  percentA,
  percentB,
  totalResponses,
  isRevealed,
  roundNumber,
  variant = "projector",
}: SlideshowQuestionProps) {
  // Calculate the race target: 90% of the minimum percentage
  const minPercent = Math.min(percentA, percentB);
  const raceTarget = minPercent * 0.9 / 100; // Convert to 0-1 scale for scaleX

  // Variant-specific styles
  const styles = {
    projector: {
      containerClass: "space-y-6",
      questionClass: "text-6xl font-bold mb-12",
      cardClass: "rounded-3xl p-10 min-h-[140px] relative overflow-hidden border-4 transition-all duration-700 ease-out",
      labelClass: "text-4xl font-bold text-white text-left flex-1",
      percentClass: "text-8xl font-bold text-white",
      percentContainerClass: "w-[200px] flex items-center justify-end",
      responseClass: "text-2xl text-purple-200 text-center pt-8 min-h-[3rem]",
      winnerBorderClass: "border-green-400",
      normalBorderClass: "border-transparent",
      winnerFillClass: "bg-gradient-to-r from-green-500/40 to-emerald-500/40",
      normalFillClass: "bg-white/10",
      textColor: "text-white",
    },
    user: {
      containerClass: "space-y-4",
      questionClass: "text-2xl md:text-3xl font-bold text-gray-900",
      cardClass: "rounded-2xl p-6 min-h-[100px] relative overflow-hidden border-4 transition-all duration-700 ease-out shadow-lg",
      labelClass: "text-lg md:text-xl font-bold text-gray-900 flex-1",
      percentClass: "text-4xl md:text-5xl font-bold text-gray-900",
      percentContainerClass: "w-[120px] flex items-center justify-end",
      responseClass: "text-center text-sm text-gray-600 min-h-[2rem]",
      winnerBorderClass: "border-green-500",
      normalBorderClass: "border-transparent",
      winnerFillClass: "bg-gradient-to-r from-green-100 to-emerald-100",
      normalFillClass: "bg-gray-100",
      textColor: "text-gray-900",
    },
    admin: {
      containerClass: "space-y-3",
      questionClass: "text-lg font-semibold text-purple-900 mb-4",
      cardClass: "rounded-lg p-3 min-h-[60px] relative overflow-hidden border-2 transition-all duration-700 ease-out",
      labelClass: "flex-1 font-medium text-gray-900 text-sm",
      percentClass: "text-2xl font-bold text-gray-900",
      percentContainerClass: "w-[80px] flex items-center justify-end",
      responseClass: "text-sm text-gray-600 text-center mt-2 min-h-[1.5rem]",
      winnerBorderClass: "border-green-500",
      normalBorderClass: "border-transparent",
      winnerFillClass: "bg-gradient-to-r from-green-100 to-emerald-100",
      normalFillClass: "bg-gray-100",
      textColor: "text-gray-900",
    },
  };

  const s = styles[variant];

  return (
    <div className={s.containerClass}>
      {/* Question */}
      <motion.div
        initial={{ opacity: 0, y: variant === "projector" ? -20 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: variant === "admin" ? 0.3 : 0.5, delay: variant === "admin" ? 0 : 0.2 }}
        className={s.questionClass}
      >
        {questionText}
      </motion.div>

      {/* Options */}
      <div className={s.containerClass}>
        {/* Option A */}
        <motion.div
          initial={{ opacity: 0, y: variant === "admin" ? 5 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: variant === "admin" ? 0.3 : 0.5, delay: variant === "admin" ? 0.1 : 0.3 }}
          className={`${s.cardClass} ${
            isRevealed && percentA >= percentB
              ? s.winnerBorderClass
              : s.normalBorderClass
          }`}
        >
          {/* Background fill animation */}
          <motion.div
            key={`fill-a-${roundNumber}`}
            initial={{ scaleX: isRevealed ? percentA / 100 : 0 }}
            animate={{ scaleX: isRevealed ? percentA / 100 : [0, raceTarget, percentA / 100] }}
            transition={{
              duration: isRevealed ? 0 : 6,
              times: isRevealed ? undefined : [0, 0.92, 1],
              ease: isRevealed ? undefined : [0.1, 0, 0.9, 1],
            }}
            className={`absolute inset-0 origin-left transition-colors duration-700 ${
              isRevealed && percentA >= percentB
                ? s.winnerFillClass
                : s.normalFillClass
            }`}
            style={{ borderRadius: "inherit" }}
          />

          {/* Content */}
          <div className="relative flex items-center justify-between gap-4">
            <div className={s.labelClass}>
              {optionA}
            </div>
            <div className={s.percentContainerClass}>
              {isRevealed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: variant === "admin" ? 0.5 : 0.8,
                    delay: 0.2,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className={s.percentClass}
                >
                  {percentA}%
                </motion.div>
              ) : null}
            </div>
          </div>
        </motion.div>

        {/* Option B */}
        <motion.div
          initial={{ opacity: 0, y: variant === "admin" ? 5 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: variant === "admin" ? 0.3 : 0.5, delay: variant === "admin" ? 0.2 : 0.4 }}
          className={`${s.cardClass} ${
            isRevealed && percentB >= percentA
              ? s.winnerBorderClass
              : s.normalBorderClass
          }`}
        >
          {/* Background fill animation */}
          <motion.div
            key={`fill-b-${roundNumber}`}
            initial={{ scaleX: isRevealed ? percentB / 100 : 0 }}
            animate={{ scaleX: isRevealed ? percentB / 100 : [0, raceTarget, percentB / 100] }}
            transition={{
              duration: isRevealed ? 0 : 6,
              times: isRevealed ? undefined : [0, 0.92, 1],
              ease: isRevealed ? undefined : [0.1, 0, 0.9, 1],
            }}
            className={`absolute inset-0 origin-left transition-colors duration-700 ${
              isRevealed && percentB >= percentA
                ? s.winnerFillClass
                : s.normalFillClass
            }`}
            style={{ borderRadius: "inherit" }}
          />

          {/* Content */}
          <div className="relative flex items-center justify-between gap-4">
            <div className={s.labelClass}>
              {optionB}
            </div>
            <div className={s.percentContainerClass}>
              {isRevealed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: variant === "admin" ? 0.5 : 0.8,
                    delay: 0.2,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className={s.percentClass}
                >
                  {percentB}%
                </motion.div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Response count - Always rendered to prevent layout shift */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isRevealed ? 1 : 0 }}
        transition={{ duration: variant === "admin" ? 0.3 : 0.5, delay: isRevealed ? (variant === "admin" ? 0.5 : 0.8) : 0 }}
        className={s.responseClass}
      >
        {isRevealed && (
          <>Based on {totalResponses} responses</>
        )}
      </motion.div>
    </div>
  );
}
