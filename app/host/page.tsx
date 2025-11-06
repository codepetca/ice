"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEmojiName } from "@/lib/avatars";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";

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
  const [joinPin, setJoinPin] = useState("");
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [presentationMode, setPresentationMode] = useState<"admin" | "fullscreen">("admin");
  const [phase2Mode, setPhase2Mode] = useState<"game" | "slideshow">("game");

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

  const roomByPin = useQuery(
    api.rooms.getRoomByPin,
    joinPin.length === 4 ? { pin: joinPin } : "skip"
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

  // Auto-reveal results after 6 seconds
  useEffect(() => {
    if (game && game.status === "in_progress" && currentRound && !currentRound.round.revealedAt) {
      const revealTimer = setTimeout(async () => {
        try {
          await revealRound({ gameId: game._id });
        } catch (err) {
          console.error("Auto-reveal error:", err);
        }
      }, 6000); // 6 seconds

      return () => clearTimeout(revealTimer);
    }
  }, [game, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance slides 6 seconds after reveal (12 seconds total)
  useEffect(() => {
    if (game && game.status === "in_progress" && currentRound?.round.revealedAt) {
      const advanceTimer = setTimeout(async () => {
        await handleNextSlide();
      }, 6000); // 6 seconds after reveal

      return () => clearTimeout(advanceTimer);
    }
  }, [game, currentRound?.round.revealedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleJoinByPin = () => {
    if (!roomByPin) {
      showToast("Room not found with that PIN", "error");
      return;
    }

    // Save to state
    setRoomId(roomByPin._id);
    setRoomCode(roomByPin.code);
    setPin(joinPin);

    // Save to localStorage
    const roomData: SavedRoom = {
      roomId: roomByPin._id,
      roomCode: roomByPin.code,
      pin: joinPin,
      roomName: roomByPin.code,
    };
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomData));
    setSavedRoom(roomData);
    setValidatedRoom(roomData);

    setView("manage");
    showToast(`Joined room ${roomByPin.code}!`, "success");
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

  const handleNextSlide = async () => {
    if (!game) return;

    try {
      // Always loop back to first slide after last slide
      await advanceRound({ gameId: game._id, loop: true });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleToggleSlideshow = async () => {
    if (!roomId) return;

    // If game exists and is in progress, stop it
    if (game && game.status === "in_progress") {
      const confirmed = await showConfirm({
        title: "Stop Slideshow?",
        message: "This will stop the presentation. You can restart it anytime.",
        confirmText: "Stop",
        cancelText: "Cancel",
      });

      if (!confirmed) return;

      try {
        await endGame({ gameId: game._id });
        showToast("Slideshow stopped!", "success");
        setPresentationMode("admin"); // Exit fullscreen if in fullscreen
      } catch (error: any) {
        showToast(error.message, "error");
      }
    } else {
      // Start or restart the slideshow
      try {
        showToast("Starting slideshow...", "info");
        const result = await generateGame({ roomId: roomId as Id<"rooms"> });
        await startGame({ gameId: result.gameId });
        showToast(`Slideshow started with ${result.totalRounds} slides!`, "success");
      } catch (error: any) {
        showToast(error.message, "error");
      }
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
                  className="text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Options
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

                  <hr className="border-t-2 border-gray-300" />

                  {/* Join by PIN Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Join existing room
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinPin}
                        onChange={(e) => setJoinPin(e.target.value.slice(0, 4))}
                        placeholder="Enter 4-digit PIN"
                        className="flex-1 px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-center tracking-widest"
                        maxLength={4}
                      />
                      <button
                        onClick={handleJoinByPin}
                        disabled={joinPin.length !== 4 || !roomByPin}
                        className={`px-6 py-4 text-lg font-semibold rounded-xl transition ${
                          joinPin.length === 4 && roomByPin
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Join
                      </button>
                    </div>
                    {joinPin.length === 4 && !roomByPin && roomByPin !== undefined && (
                      <p className="text-sm text-red-600 mt-2">Room not found with that PIN</p>
                    )}
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
                  className="text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Options
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

                  <hr className="border-t-2 border-gray-300" />

                  {/* Join by PIN Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Join existing room
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinPin}
                        onChange={(e) => setJoinPin(e.target.value.slice(0, 4))}
                        placeholder="Enter 4-digit PIN"
                        className="flex-1 px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-center tracking-widest"
                        maxLength={4}
                      />
                      <button
                        onClick={handleJoinByPin}
                        disabled={joinPin.length !== 4 || !roomByPin}
                        className={`px-6 py-4 text-lg font-semibold rounded-xl transition ${
                          joinPin.length === 4 && roomByPin
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Join
                      </button>
                    </div>
                    {joinPin.length === 4 && !roomByPin && roomByPin !== undefined && (
                      <p className="text-sm text-red-600 mt-2">Room not found with that PIN</p>
                    )}
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

    if (presentationMode === "fullscreen" && game && game.status === "in_progress" && currentRound) {
      // Render fullscreen presentation
      return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-auto">
          {/* Exit button */}
          <button
            onClick={() => setPresentationMode("admin")}
            className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-all duration-300 text-sm font-semibold"
          >
            Exit Fullscreen
          </button>

          <div className="min-h-screen p-12 flex flex-col">
            {/* Question */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-6xl space-y-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentRound.round.roundNumber}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{
                      duration: 0.6,
                      ease: [0.4, 0.0, 0.2, 1]
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
            </div>
          </div>
        </div>
      );
    }

    return (
      <main className="min-h-screen p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl mx-auto space-y-8"
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

          {/* Game & Slideshow Tabs */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setPhase2Mode("game")}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition ${
                  phase2Mode === "game"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Game
              </button>
              <button
                onClick={() => setPhase2Mode("slideshow")}
                className={`flex-1 px-6 py-4 text-lg font-semibold transition ${
                  phase2Mode === "slideshow"
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Slideshow
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-8 space-y-6">
              {phase2Mode === "game" ? (
                /* Game Mode Content - Phase 1 Timer & Controls */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${room.windingDownStartedAt ? 'text-orange-500' : 'text-gray-900'}`}>
                      {minutes}:{seconds.toString().padStart(2, "0")}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {!room.phase1Active ? (
                      <button
                        onClick={handleStartPhase1}
                        className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
                      >
                        Start Game
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
                        Stop Game
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                  /* Slideshow Mode Content */
                  <>
                    {!game || game.status !== "in_progress" ? (
                      <div className="space-y-4">
                        <button
                          onClick={handleToggleSlideshow}
                          className="w-full px-8 py-4 text-xl font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition"
                        >
                          Start Slideshow
                        </button>
                      </div>
                    ) : game.status === "in_progress" && currentRound ? (
                      <div className="space-y-6">
                        {/* Control Row */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="text-sm font-medium text-gray-600">
                            Slide {gameState?.game?.currentRound} of {gameState?.game?.totalRounds}
                            {!currentRound.round.revealedAt && <span className="text-purple-600"> • Revealing in 6s...</span>}
                            {currentRound.round.revealedAt && <span className="text-purple-600"> • Next slide in 6s...</span>}
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Fullscreen Toggle */}
                            <button
                              onClick={() => setPresentationMode(presentationMode === "admin" ? "fullscreen" : "admin")}
                              className="px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                              📺 Fullscreen
                            </button>

                            <button
                              onClick={handleToggleSlideshow}
                              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                              Stop
                            </button>
                          </div>
                        </div>

                        {/* Admin Preview (only show when not in fullscreen) */}
                        {presentationMode === "admin" && currentRound.questionData && (
                          <div className="bg-purple-50 rounded-xl p-6">
                            <SlideshowQuestion
                              questionText={currentRound.questionData.text || currentRound.round.questionText}
                              optionA={currentRound.questionData.optionA}
                              optionB={currentRound.questionData.optionB}
                              percentA={currentRound.questionData.percentA}
                              percentB={currentRound.questionData.percentB}
                              totalResponses={currentRound.questionData.totalResponses}
                              isRevealed={!!currentRound.round.revealedAt}
                              roundNumber={currentRound.round.roundNumber}
                              variant="admin"
                            />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>

          {/* Room Users List */}
          {roomUsers && roomUsers.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Collapsible Header */}
              <button
                onClick={() => setUsersExpanded(!usersExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900">Participants</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {roomUsers.length}
                  </span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 text-gray-400 transition-transform ${usersExpanded ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Expandable Content */}
              {usersExpanded && (
                <div className="px-6 pb-6">
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
            </div>
          )}
          </motion.div>
        </main>
    );
  }

  return null;
}
