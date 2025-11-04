"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { Keypad } from "@/components/Keypad";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="text-6xl mb-4">📺</div>
          <h1 className="text-5xl font-bold mb-4">Projector View</h1>
          <p className="text-xl text-purple-200 mb-8">
            Enter the room code
          </p>

          {/* Code Display */}
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="w-16 h-20 flex items-center justify-center text-4xl font-bold border-2 border-purple-300 rounded-xl bg-white text-gray-900"
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
        <LoadingSpinner size="lg" color="border-purple-300 border-t-white" />
      </main>
    );
  }

  const timeElapsed = room.phase1StartedAt
    ? Math.max(0, Math.floor((Date.now() - room.phase1StartedAt) / 1000))
    : 0;
  const timeRemaining = Math.max(0, room.phase1Duration - timeElapsed);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Phase 2 Completed - Show Leaderboard
  if (game && game.status === "completed" && leaderboard) {
    return (
      <main className="min-h-screen p-12 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="text-9xl">🏆</div>
            <h1 className="text-8xl font-bold">Final Results</h1>
            <div className="text-3xl text-purple-200">
              Room Code: <span className="font-bold text-white">{roomCode}</span>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {leaderboard.map((entry, index) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex items-center gap-8"
              >
                <div className="text-6xl font-bold text-yellow-300 w-24 text-center">
                  #{entry.rank}
                </div>
                <div className="text-8xl">{entry.avatar}</div>
                <div className="flex-1">
                  <div className="text-4xl font-semibold text-white">
                    {entry.totalCorrect}/{entry.totalVotes}
                  </div>
                  <div className="text-2xl text-purple-200">correct</div>
                </div>
                {entry.rank === 1 && <div className="text-6xl">👑</div>}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Disconnect button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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

  // Phase 2 In Progress
  if (game && game.status === "in_progress" && currentRound) {
    return (
      <main className="min-h-screen p-12 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="text-2xl text-purple-200 uppercase tracking-wider">
              Phase 2: Summary Game
            </div>
            <h1 className="text-6xl font-bold">
              Question {currentRound.round.roundNumber} of {game.totalRounds}
            </h1>
          </motion.div>

          {/* Question */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center"
          >
            <div className="text-5xl font-bold mb-8">
              {currentRound.round.questionText}
            </div>
          </motion.div>

          {/* Vote Bars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-32 text-5xl font-bold text-purple-300">A) ≥50%</div>
                <div className="flex-1 bg-purple-300/30 rounded-full h-24 relative overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-full flex items-center justify-end pr-8"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${currentRound.voteCounts.total > 0 ? (currentRound.voteCounts.A / currentRound.voteCounts.total) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <span className="text-4xl font-bold">{currentRound.voteCounts.A}</span>
                  </motion.div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="w-32 text-5xl font-bold text-blue-300">B) &lt;50%</div>
                <div className="flex-1 bg-blue-300/30 rounded-full h-24 relative overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full flex items-center justify-end pr-8"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${currentRound.voteCounts.total > 0 ? (currentRound.voteCounts.B / currentRound.voteCounts.total) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <span className="text-4xl font-bold">{currentRound.voteCounts.B}</span>
                  </motion.div>
                </div>
              </div>

              <div className="text-center text-3xl text-purple-200 pt-4">
                {currentRound.voteCounts.total} / {stats?.totalUsers || 0} votes
              </div>
            </div>

            {/* Reveal Section */}
            {currentRound.round.revealedAt && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-3xl p-12 border-4 border-yellow-400"
              >
                <div className="text-center space-y-6">
                  <div className="text-4xl text-yellow-300 uppercase tracking-wider">
                    Actual Answer
                  </div>
                  <div className="text-9xl font-bold text-white">
                    {currentRound.round.actualPercentage.toFixed(1)}%
                  </div>
                  <div className="text-5xl font-bold text-yellow-300">
                    Correct: {currentRound.round.correctAnswer}) {currentRound.round.correctAnswer === "A" ? "≥50%" : "<50%"}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Disconnect button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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

  // Phase 1
  return (
    <main className="min-h-screen p-12 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-7xl font-bold">{room.name}</h1>
          <div className="text-3xl text-purple-200">
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
              <div className="text-2xl text-purple-200 uppercase tracking-wider">
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
            <div className="text-3xl text-purple-200 uppercase tracking-wider">
              Students
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center space-y-4">
            <div className="text-8xl font-bold text-blue-300">
              {stats?.activeGroups || 0}
            </div>
            <div className="text-3xl text-purple-200 uppercase tracking-wider">
              Active Groups
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center space-y-4">
            <div className="text-8xl font-bold text-green-300">
              {stats?.completedGroups || 0}
            </div>
            <div className="text-3xl text-purple-200 uppercase tracking-wider">
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
            <div className="text-4xl font-semibold text-purple-200">
              Waiting for teacher to start Phase 1...
            </div>
            <div className="text-2xl text-purple-300">
              Students can join at <span className="font-mono">/student</span>
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
            <div className="text-3xl font-semibold text-purple-200">
              💬 Students are connecting and talking!
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
