"use client";

import { useEffect, useState } from "react";

interface RoundProgressBarProps {
  currentRound: number;
  totalRounds: number;
  roundStartedAt: number | undefined;
}

export default function RoundProgressBar({
  currentRound,
  totalRounds,
  roundStartedAt,
}: RoundProgressBarProps) {
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!roundStartedAt) {
      setTimeRemaining(30);
      setProgress(100);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - roundStartedAt;
      const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));
      const progressPercent = Math.max(0, ((30000 - elapsed) / 30000) * 100);

      setTimeRemaining(remaining);
      setProgress(progressPercent);
    };

    // Update immediately
    updateTimer();

    // Update every 100ms for smooth animation
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [roundStartedAt]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Round {currentRound}/{totalRounds}
        </div>
        <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
          {timeRemaining}s
        </div>
      </div>

      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
