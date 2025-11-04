"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEmojiName } from "@/lib/avatars";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const ROOM_STORAGE_KEY = "ice-host-room";

interface SavedRoom {
  roomId: string;
  roomCode: string;
  pin: string;
  roomName: string;
}

// Generate random room name like "cosmic-garden" or "quiet-mountain"
function generateRoomName(): string {
  const adjectives = [
    "cosmic", "quiet", "bright", "hidden", "swift", "gentle", "wild", "calm",
    "golden", "silver", "mystic", "peaceful", "rapid", "ancient", "modern",
    "frozen", "warm", "cool", "dark", "light", "deep", "high", "wide",
  ];

  const nouns = [
    "garden", "mountain", "river", "forest", "ocean", "valley", "meadow",
    "canyon", "island", "desert", "tundra", "prairie", "harbor", "summit",
    "cave", "beach", "lake", "creek", "ridge", "plateau", "cliff", "shore",
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}

export default function HostPage() {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [view, setView] = useState<"create" | "manage">("create");
  const [duration, setDuration] = useState(10); // minutes
  const [maxGroupSize, setMaxGroupSize] = useState(4);
  const [showOptions, setShowOptions] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [pin, setPin] = useState("");
  const [savedRoom, setSavedRoom] = useState<SavedRoom | null>(null);
  const [validatedRoom, setValidatedRoom] = useState<SavedRoom | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [validatingSavedRoom, setValidatingSavedRoom] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const createRoom = useMutation(api.rooms.createRoom);
  const startPhase1 = useMutation(api.rooms.startPhase1);
  const stopPhase1 = useMutation(api.rooms.stopPhase1);
  const seedQuestions = useMutation(api.questions.seedQuestions);
  const removeUser = useMutation(api.users.removeUser);

  // Phase 2 mutations
  const generateGame = useMutation(api.games.generateGame);
  const startGame = useMutation(api.games.startGame);
  const revealRound = useMutation(api.games.revealRound);
  const advanceRound = useMutation(api.games.advanceRound);
  const endGame = useMutation(api.games.endGame);

  // Query to validate saved room on mount
  const savedRoomQuery = useQuery(
    api.rooms.getRoomById,
    savedRoom ? { roomId: savedRoom.roomId as Id<"rooms"> } : "skip"
  );

  const room = useQuery(
    api.rooms.getRoomById,
    roomId ? { roomId: roomId as Id<"rooms"> } : "skip"
  );

  const stats = useQuery(
    api.rooms.getRoomStats,
    roomId ? { roomId: roomId as Id<"rooms"> } : "skip"
  );

  const roomUsers = useQuery(
    api.users.getRoomUsers,
    roomId ? { roomId: roomId as Id<"rooms"> } : "skip"
  );

  // Phase 2 queries
  const game = useQuery(
    api.games.getGameByRoom,
    roomId ? { roomId: roomId as Id<"rooms"> } : "skip"
  );

  const gameState = useQuery(
    api.games.getGameState,
    game ? { gameId: game._id } : "skip"
  );

  const currentRound = useQuery(
    api.games.getCurrentRound,
    game ? { gameId: game._id } : "skip"
  );

  const leaderboard = useQuery(
    api.games.getLeaderboard,
    game ? { gameId: game._id } : "skip"
  );

  // Load saved room from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SavedRoom;
        setSavedRoom(parsed);
        setValidatingSavedRoom(true);
      } catch (e) {
        localStorage.removeItem(ROOM_STORAGE_KEY);
      }
    }
  }, []);

  // Validate saved room automatically
  useEffect(() => {
    if (validatingSavedRoom && savedRoom) {
      if (savedRoomQuery === null) {
        // Room doesn't exist (expired or deleted)
        localStorage.removeItem(ROOM_STORAGE_KEY);
        setSavedRoom(null);
        setValidatedRoom(null);
        setValidatingSavedRoom(false);
      } else if (savedRoomQuery !== undefined) {
        // Room exists and is valid
        setValidatedRoom(savedRoom);
        setValidatingSavedRoom(false);
      }
    }
  }, [validatingSavedRoom, savedRoom, savedRoomQuery]);

  // Timer update interval for admin dashboard
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-trigger winding down at 15 seconds remaining
  useEffect(() => {
    if (room && room.phase1Active && room.phase1StartedAt && !room.windingDownStartedAt) {
      const timeElapsed = Math.floor((Date.now() - room.phase1StartedAt) / 1000);
      const timeRemaining = room.phase1Duration - timeElapsed;

      if (timeRemaining <= 15 && roomId && pin) {
        handleStopPhase1(true); // Skip confirmation for auto-trigger
      }
    }
  }, [room, currentTime, roomId, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRoom = async () => {
    try {
      // Seed questions first time
      await seedQuestions();

      // Use generated room name for internal reference
      const internalName = generateRoomName();

      const result = await createRoom({
        name: internalName,
        phase1Duration: duration * 60, // convert to seconds
        maxGroupSize: maxGroupSize,
      });

      // Save to state
      setRoomId(result.roomId);
      setRoomCode(result.code);
      setPin(result.pin);

      // Save to localStorage (store code as the display name)
      const roomData: SavedRoom = {
        roomId: result.roomId,
        roomCode: result.code,
        pin: result.pin,
        roomName: result.code, // Use room code as the display name
      };
      localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomData));
      setSavedRoom(roomData);
      setValidatedRoom(roomData); // New room is automatically valid

      setView("manage");
      showToast("Room created successfully!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleContinueToRoom = () => {
    if (!validatedRoom) return;
    setRoomId(validatedRoom.roomId);
    setRoomCode(validatedRoom.roomCode);
    setPin(validatedRoom.pin);
    setView("manage");
  };

  const handleCreateNewRoom = () => {
    // Clear saved room to show create form
    localStorage.removeItem(ROOM_STORAGE_KEY);
    setSavedRoom(null);
    setValidatedRoom(null);
  };

  const handleStartPhase1 = async () => {
    if (!roomId || !pin) return;

    try {
      await startPhase1({ roomId: roomId as Id<"rooms">, pin });
      showToast("Phase 1 started!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleStopPhase1 = async (skipConfirm = false) => {
    if (!roomId || !pin) return;

    if (!skipConfirm) {
      const confirmed = await showConfirm({
        title: "Stop Session?",
        message: "Users will have 15 seconds to finish their current activity.",
        confirmText: "Stop",
        cancelText: "Cancel",
      });

      if (!confirmed) return;
    }

    try {
      await stopPhase1({ roomId: roomId as Id<"rooms">, pin });
      showToast("Winding down - session will stop in 15 seconds", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!pin) return;

    try {
      await removeUser({ userId: userId as Id<"users">, roomPin: pin });
      showToast("User removed", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Phase 2 handlers
  const handleLaunchPhase2 = async () => {
    if (!roomId) return;

    try {
      showToast("Generating questions...", "info");
      const result = await generateGame({ roomId: roomId as Id<"rooms"> });
      await startGame({ gameId: result.gameId });
      showToast(`Phase 2 started with ${result.totalRounds} questions!`, "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleRevealResults = async () => {
    if (!game) return;

    try {
      await revealRound({ gameId: game._id });
      showToast("Results revealed!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleNextQuestion = async () => {
    if (!game) return;

    try {
      await advanceRound({ gameId: game._id });
      if (gameState?.game && gameState.game.currentRound >= gameState.game.totalRounds) {
        showToast("Game completed!", "success");
      } else {
        showToast("Next question!", "success");
      }
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleEndPhase2 = async () => {
    if (!game) return;

    const confirmed = await showConfirm({
      title: "End Phase 2?",
      message: "This will end the game and show the final leaderboard.",
      confirmText: "End Game",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      await endGame({ gameId: game._id });
      showToast("Phase 2 ended!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Create view
  if (view === "create") {
    // Show loading state while validating saved room
    if (validatingSavedRoom) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <LoadingSpinner size="lg" color="border-green-200 border-t-green-600" />
          </motion.div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <h1 className="text-6xl font-bold text-center text-gray-900">
            Ice
          </h1>

          {validatedRoom ? (
            // Show continue to saved room option
            <div className="space-y-6">
              <button
                onClick={handleCreateRoom}
                className="w-full px-8 py-6 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition shadow-lg"
              >
                Create New Room
              </button>

              {/* Options Toggle */}
              <div className="text-right">
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline transition"
                >
                  {showOptions ? "Hide options" : "options"}
                </button>
              </div>

              {/* Collapsible Options */}
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none bg-white appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Group Size
                    </label>
                    <select
                      value={maxGroupSize}
                      onChange={(e) => setMaxGroupSize(parseInt(e.target.value))}
                      className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none bg-white appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value={2}>2 people</option>
                      <option value={3}>3 people</option>
                      <option value={4}>4 people</option>
                      <option value={5}>5 people</option>
                      <option value={6}>6 people</option>
                    </select>
                  </div>
                </motion.div>
              )}

              <hr className="border-t-2 border-gray-300" />

              <button
                onClick={handleContinueToRoom}
                className="w-full px-8 py-4 text-xl font-semibold text-green-700 border-2 border-green-600 rounded-xl hover:bg-green-50 transition"
              >
                Continue to {validatedRoom.roomCode}
              </button>
            </div>
          ) : (
            // No saved room, show create form
            <div className="space-y-6">
              <button
                onClick={handleCreateRoom}
                className="w-full px-8 py-6 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition shadow-lg"
              >
                Create Room
              </button>

              {/* Options Toggle */}
              <div className="text-right">
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline transition"
                >
                  {showOptions ? "Hide options" : "options"}
                </button>
              </div>

              {/* Collapsible Options */}
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none bg-white appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Group Size
                    </label>
                    <select
                      value={maxGroupSize}
                      onChange={(e) => setMaxGroupSize(parseInt(e.target.value))}
                      className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none bg-white appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value={2}>2 people</option>
                      <option value={3}>3 people</option>
                      <option value={4}>4 people</option>
                      <option value={5}>5 people</option>
                      <option value={6}>6 people</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    );
  }

  // Manage view
  if (view === "manage" && room) {
    // Calculate winding down progress
    const windingDownElapsed = room.windingDownStartedAt
      ? Math.max(0, Math.floor((currentTime - room.windingDownStartedAt) / 1000))
      : 0;
    const windingDownRemaining = Math.max(0, 15 - windingDownElapsed);

    // Use winding down time if in winding down mode, otherwise use normal time
    const timeElapsed = room.phase1StartedAt && room.phase1Active
      ? Math.max(0, Math.floor((currentTime - room.phase1StartedAt) / 1000))
      : 0;
    const normalTimeRemaining = Math.max(0, room.phase1Duration - timeElapsed);

    const timeRemaining = room.windingDownStartedAt ? windingDownRemaining : normalTimeRemaining;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-8"
        >
          <div className="text-center space-y-4">
            {/* Room Code Display */}
            <div className="flex justify-center gap-3">
              {roomCode.split('').map((letter, index) => (
                <div
                  key={index}
                  className="w-20 h-24 flex items-center justify-center text-5xl font-bold border-4 border-blue-300 rounded-2xl bg-blue-600 shadow-lg uppercase text-white"
                >
                  {letter}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">

            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${room.windingDownStartedAt ? 'text-orange-500' : 'text-gray-900'}`}>
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              {!room.phase1Active ? (
                <button
                  onClick={handleStartPhase1}
                  className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
                >
                  Start
                </button>
              ) : room.windingDownStartedAt ? (
                <button
                  disabled
                  className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-gray-400 rounded-xl cursor-not-allowed"
                >
                  Stopping...
                </button>
              ) : (
                <button
                  onClick={() => handleStopPhase1()}
                  className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Room Users List */}
          {roomUsers && roomUsers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {/* Search/Filter Box */}
              <div className="mb-4 relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...roomUsers]
                  .sort((a, b) => {
                    const nameA = getEmojiName(a.avatar);
                    const nameB = getEmojiName(b.avatar);
                    return nameA.localeCompare(nameB);
                  })
                  .filter((user) => {
                    const userName = getEmojiName(user.avatar).toLowerCase();

                    // Filter by search text
                    if (userSearch && !userName.includes(userSearch.toLowerCase())) {
                      return false;
                    }

                    return true;
                  })
                  .map((user) => (
                    <div
                      key={user.id}
                      className="relative bg-gray-50 rounded-xl p-3 text-center group hover:bg-gray-100 transition"
                    >
                      <div className="text-4xl mb-1">{user.avatar}</div>
                      <div className="text-xs text-gray-600 capitalize">
                        {getEmojiName(user.avatar)}
                      </div>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
                        title="Remove user"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Phase 2 Section */}
          {!room.phase1Active && !room.windingDownStartedAt && (
            <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Phase 2: Summary Game</h2>

              {!game || game.status === "not_started" ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Generate questions based on Phase 1 responses and let participants vote on the class data!
                  </p>
                  <button
                    onClick={handleLaunchPhase2}
                    className="w-full px-8 py-4 text-xl font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition"
                  >
                    Launch Phase 2
                  </button>
                </div>
              ) : game.status === "in_progress" && currentRound ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-600">
                      Question {gameState?.game?.currentRound} of {gameState?.game?.totalRounds}
                    </div>
                    <button
                      onClick={handleEndPhase2}
                      className="text-sm text-red-600 hover:text-red-700 underline"
                    >
                      End Game
                    </button>
                  </div>

                  {/* Current Question */}
                  <div className="bg-purple-50 rounded-xl p-6">
                    <div className="text-lg font-semibold text-purple-900 mb-4">
                      {currentRound.round.questionText}
                    </div>

                    {/* Vote Counts */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 text-center font-bold text-purple-600">A) ≥50%</div>
                        <div className="flex-1 bg-purple-200 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="bg-purple-600 h-full transition-all duration-500"
                            style={{
                              width: `${currentRound.voteCounts.total > 0 ? (currentRound.voteCounts.A / currentRound.voteCounts.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="w-16 text-right font-bold text-purple-900">
                          {currentRound.voteCounts.A}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-16 text-center font-bold text-blue-600">B) &lt;50%</div>
                        <div className="flex-1 bg-blue-200 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-500"
                            style={{
                              width: `${currentRound.voteCounts.total > 0 ? (currentRound.voteCounts.B / currentRound.voteCounts.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="w-16 text-right font-bold text-blue-900">
                          {currentRound.voteCounts.B}
                        </div>
                      </div>
                    </div>

                    {/* Vote Progress */}
                    <div className="mt-4 text-center text-sm text-gray-600">
                      {currentRound.voteCounts.total} / {roomUsers?.length || 0} voted
                    </div>

                    {/* Reveal Section */}
                    {currentRound.round.revealedAt && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 p-4 bg-white rounded-xl border-2 border-purple-300"
                      >
                        <div className="text-center">
                          <div className="text-sm text-gray-600 mb-1">Actual Percentage:</div>
                          <div className="text-3xl font-bold text-purple-600">
                            {currentRound.round.actualPercentage.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            Correct Answer: <span className="font-bold">{currentRound.round.correctAnswer}) {currentRound.round.correctAnswer === "A" ? "≥50%" : "<50%"}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex gap-4">
                    {!currentRound.round.revealedAt ? (
                      <button
                        onClick={handleRevealResults}
                        className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition"
                      >
                        Reveal Results
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
                      >
                        {gameState?.game && gameState.game.currentRound >= gameState.game.totalRounds ? "View Leaderboard" : "Next Question"}
                      </button>
                    )}
                  </div>
                </div>
              ) : game.status === "completed" && leaderboard ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">🏆 Final Leaderboard</div>
                    <p className="text-gray-600">Top performers in the Summary Game</p>
                  </div>

                  <div className="space-y-3">
                    {leaderboard.map((entry, index) => (
                      <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-white rounded-xl p-4 border-2 border-purple-200"
                      >
                        <div className="text-3xl font-bold text-purple-600 w-12 text-center">
                          #{entry.rank}
                        </div>
                        <div className="text-4xl">{entry.avatar}</div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-600 capitalize">
                            {getEmojiName(entry.avatar)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {entry.totalCorrect}/{entry.totalVotes}
                          </div>
                          <div className="text-xs text-gray-500">correct</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      localStorage.removeItem(ROOM_STORAGE_KEY);
                      setRoomId(null);
                      setSavedRoom(null);
                      setValidatedRoom(null);
                      setView("create");
                    }}
                    className="w-full px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
                  >
                    Create New Room
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      </main>
    );
  }

  return null;
}
