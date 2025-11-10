"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

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
  isPreview?: boolean; // True when showing a stopped/preview state
  onRevealComplete?: () => void; // Called after animation completes and percentages are shown
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
  isPreview = false,
  onRevealComplete,
}: SlideshowQuestionProps) {
  // Local state to show percentages after animation completes
  const [showPercentages, setShowPercentages] = useState(isRevealed);

  // Auto-show percentages after 6 second animation if not already revealed
  useEffect(() => {
    if (isRevealed) {
      setShowPercentages(true);
    } else if (!isPreview) {
      const timer = setTimeout(() => {
        setShowPercentages(true);
        // Notify parent that reveal is complete (save to database)
        if (onRevealComplete) {
          onRevealComplete();
        }
      }, 6000); // Match the animation duration
      return () => clearTimeout(timer);
    }
  }, [isRevealed, isPreview, roundNumber, onRevealComplete]);
  // Calculate the race target: 90% of the minimum percentage
  const minPercent = Math.min(percentA, percentB);
  const raceTarget = minPercent * 0.9 / 100; // Convert to 0-1 scale for scaleX

  // Variant-specific styles - minimal and clean
  const styles = {
    projector: {
      containerClass: "space-y-6",
      questionClass: "text-5xl md:text-6xl font-display font-bold mb-12 text-foreground",
      cardClass: "rounded-lg p-8 min-h-[120px] relative overflow-hidden border-2 transition-all duration-700 ease-out",
      labelClass: "text-3xl md:text-4xl font-display font-bold text-card-foreground text-left flex-1",
      percentClass: "text-6xl md:text-7xl font-display font-bold text-card-foreground",
      percentContainerClass: "w-[180px] flex items-center justify-end",
      responseClass: "text-xl font-sans text-muted-foreground text-center pt-6 min-h-[3rem]",
      winnerBorderClass: "border-success",
      normalBorderClass: "border-border",
      winnerFillClass: "bg-success/20",
      normalFillClass: "bg-muted/70",
      textColor: "text-card-foreground",
    },
    user: {
      containerClass: "space-y-4",
      questionClass: "text-xl md:text-2xl font-display font-bold",
      cardClass: "rounded-lg p-5 min-h-[90px] relative overflow-hidden border-2 transition-all duration-700 ease-out shadow-sm",
      labelClass: "text-base md:text-lg font-display font-bold flex-1",
      percentClass: "text-3xl md:text-4xl font-display font-bold",
      percentContainerClass: "w-[100px] flex items-center justify-end",
      responseClass: "text-center text-sm font-sans text-muted-foreground min-h-[2rem]",
      winnerBorderClass: "border-success",
      normalBorderClass: "border-border",
      winnerFillClass: "bg-success/20",
      normalFillClass: "bg-muted/70",
      textColor: "text-foreground",
    },
    admin: {
      containerClass: "space-y-3",
      questionClass: "text-base font-display font-semibold mb-3",
      cardClass: "rounded-lg p-3 min-h-[60px] relative overflow-hidden border-2 transition-all duration-700 ease-out",
      labelClass: "flex-1 font-sans font-medium text-sm",
      percentClass: "text-xl font-display font-bold",
      percentContainerClass: "w-[70px] flex items-center justify-end",
      responseClass: "text-xs font-sans text-muted-foreground text-center mt-2 min-h-[1.5rem]",
      winnerBorderClass: "border-success",
      normalBorderClass: "border-border",
      winnerFillClass: "bg-success/20",
      normalFillClass: "bg-muted/70",
      textColor: "text-foreground",
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
            initial={{ scaleX: isPreview ? 0 : (isRevealed ? percentA / 100 : 0) }}
            animate={{ scaleX: isPreview ? 0 : (isRevealed ? percentA / 100 : [0, raceTarget, percentA / 100]) }}
            transition={{
              duration: isRevealed || isPreview ? 0 : 6,
              times: isRevealed || isPreview ? undefined : [0, 0.92, 1],
              ease: isRevealed || isPreview ? undefined : [0.1, 0, 0.9, 1],
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
              {showPercentages ? (
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
            initial={{ scaleX: isPreview ? 0 : (isRevealed ? percentB / 100 : 0) }}
            animate={{ scaleX: isPreview ? 0 : (isRevealed ? percentB / 100 : [0, raceTarget, percentB / 100]) }}
            transition={{
              duration: isRevealed || isPreview ? 0 : 6,
              times: isRevealed || isPreview ? undefined : [0, 0.92, 1],
              ease: isRevealed || isPreview ? undefined : [0.1, 0, 0.9, 1],
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
              {showPercentages ? (
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
        animate={{ opacity: showPercentages ? 1 : 0 }}
        transition={{ duration: variant === "admin" ? 0.3 : 0.5, delay: showPercentages ? (variant === "admin" ? 0.5 : 0.8) : 0 }}
        className={s.responseClass}
      >
        {showPercentages && (
          <>Based on {totalResponses} responses</>
        )}
      </motion.div>
    </div>
  );
}
