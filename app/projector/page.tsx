"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { Keypad } from "@/components/Keypad";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";
import { TitleBar } from "@/components/TitleBar";

export default function ProjectorPage() {
  const [roomCode, setClassCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [storedClassCode, setStoredClassCode] = useState<string | null>(null);

  const room = useQuery(
    api.rooms.getRoom,
    storedClassCode ? { code: storedClassCode } : "skip"
  );

  const stats = useQuery(
    api.rooms.getRoomStats,
    room?._id ? { roomId: room._id } : "skip"
  );

  // Phase 2 queries
  const game = useQuery(
    api.games.getGameByRoom,
    room?._id ? { roomId: room._id } : "skip"
  );

  const currentRound = useQuery(
    api.games.getCurrentRound,
    game ? { gameId: game._id } : "skip"
  );

  const leaderboard = useQuery(
    api.games.getLeaderboard,
    game && game.status === "completed" ? { gameId: game._id } : "skip"
  );

  // Auto-connect when 4 digits entered
  useEffect(() => {
    if (roomCode.length === 4) {
      setStoredClassCode(roomCode);
      setConnected(true);
    }
  }, [roomCode]);

  if (!connected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-900 to-blue-900 text-white">
        <TitleBar />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="text-6xl mb-4">📺</div>
          <h1 className="text-5xl font-bold mb-4">Projector View</h1>
          <p className="text-xl text-accent-200 mb-8">
            Enter the room code
          </p>

          {/* Code Display */}
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="w-16 h-20 flex items-center justify-center text-4xl font-bold border-2 border-primary-300 rounded-xl bg-white text-gray-900"
              >
                {roomCode[index] || ""}
              </div>
            ))}
          </div>

          {/* Keypad */}
          <Keypad value={roomCode} onChange={setClassCode} maxLength={4} />
        </motion.div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-900 to-blue-900 text-white">
        <TitleBar />
        <LoadingSpinner size="lg" color="border-primary-300 border-t-white" />
      </main>
    );
  }

  const timeElapsed = room.phase1StartedAt
    ? Math.max(0, Math.floor((Date.now() - room.phase1StartedAt) / 1000))
    : 0;
  const timeRemaining = Math.max(0, room.phase1Duration - timeElapsed);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Phase 2 Slideshow
  if (game && game.status === "in_progress" && currentRound) {
    return (
      <main className="min-h-screen p-12 bg-background dark:bg-card text-white flex items-center justify-center">
        <TitleBar />

        {/* Slide Counter - Top Center */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-center">
          <div className="text-2xl text-muted-foreground">
            {currentRound.round.roundNumber} / {game.totalRounds}
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-12">
          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRound.round.roundNumber}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{
                duration: 0.6,
                ease: [0.4, 0.0, 0.2, 1] // Custom cubic-bezier for smooth easing
              }}
              className="text-center"
            >
              {currentRound.questionData && (
                <SlideshowQuestion
                  questionText={currentRound.questionData.text || currentRound.round.questionText}
                  optionA={currentRound.questionData.optionA}
                  optionB={currentRound.questionData.optionB}
                  percentA={currentRound.questionData.percentA}
                  percentB={currentRound.questionData.percentB}
                  totalResponses={currentRound.questionData.totalResponses}
                  isRevealed={!!currentRound.round.revealedAt}
                  roundNumber={currentRound.round.roundNumber}
                  variant="projector"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Disconnect button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={() => {
            setConnected(false);
            setStoredClassCode(null);
            setClassCode("");
          }}
          className="fixed bottom-8 right-8 px-6 py-3 text-lg bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition-all duration-300"
        >
          Disconnect
        </motion.button>
      </main>
    );
  }

  // Phase 1
  return (
    <main className="min-h-screen p-12 bg-background dark:bg-card text-white">
      <TitleBar />

      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-7xl font-bold">{room.name}</h1>
          <div className="text-3xl text-accent-200">
            Room Code: <span className="font-bold text-white">{roomCode}</span>
          </div>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center"
        >
          <div
            className={`px-12 py-6 rounded-3xl text-4xl font-bold ${
              room.phase1Active
                ? "bg-green-500 text-white"
                : "bg-gray-500 text-gray-200"
            }`}
          >
            {room.phase1Active ? "🟢 ACTIVE" : "⚪ NOT STARTED"}
          </div>
        </motion.div>

        {/* Timer */}
        <AnimatePresence>
          {room.phase1Active && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center space-y-4"
            >
              <div className="text-2xl text-accent-200 uppercase tracking-wider">
                Time Remaining
              </div>
              <div className="text-9xl font-bold tabular-nums">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-8"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center space-y-4">
            <div className="text-8xl font-bold text-white">
              {stats?.totalUsers || 0}
            </div>
            <div className="text-3xl text-accent-200 uppercase tracking-wider">
              Users
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center space-y-4">
            <div className="text-8xl font-bold text-secondary-300">
              {stats?.activeGroups || 0}
            </div>
            <div className="text-3xl text-accent-200 uppercase tracking-wider">
              Active Groups
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center space-y-4">
            <div className="text-8xl font-bold text-green-300">
              {stats?.completedGroups || 0}
            </div>
            <div className="text-3xl text-accent-200 uppercase tracking-wider">
              Completed
            </div>
          </div>
        </motion.div>

        {/* Instructions */}
        {!room.phase1Active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center space-y-6 pt-8"
          >
            <div className="text-4xl font-semibold text-accent-200">
              Waiting for host to start Phase 1...
            </div>
            <div className="text-2xl text-accent-300">
              Users can join at <span className="font-mono">/user</span>
            </div>
          </motion.div>
        )}

        {room.phase1Active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center space-y-4 pt-8"
          >
            <div className="text-3xl font-semibold text-accent-200">
              💬 Users are connecting and talking!
            </div>
          </motion.div>
        )}
      </div>

      {/* Disconnect button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={() => {
          setConnected(false);
          setStoredClassCode(null);
          setClassCode("");
        }}
        className="fixed bottom-8 right-8 px-6 py-3 text-lg bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition"
      >
        Disconnect
      </motion.button>
    </main>
  );
}
