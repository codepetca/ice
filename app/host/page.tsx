"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEmojiName } from "@/lib/avatars";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";
import { Maximize, Minimize, Play, Pause, Square, Settings, Sun, Moon, Snowflake, ChevronUp, ChevronDown, Users, RotateCcw, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

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
  const [lastUserCount, setLastUserCount] = useState(0);
  const [joinNotifications, setJoinNotifications] = useState<Array<{ id: string; avatar: string; x: number; y: number }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showNewGameButton, setShowNewGameButton] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const startPhase1 = useMutation(api.rooms.startPhase1);
  const stopPhase1 = useMutation(api.rooms.stopPhase1);
  const adjustPhase1Duration = useMutation(api.rooms.adjustPhase1Duration);
  const resetRoom = useMutation(api.rooms.resetRoom);
  const seedQuestions = useMutation(api.questions.seedQuestions);
  const removeUser = useMutation(api.users.removeUser);

  // Phase 2 mutations
  const generateGame = useMutation(api.games.generateGame);
  const startGame = useMutation(api.games.startGame);
  const revealRound = useMutation(api.games.revealRound);
  const advanceRound = useMutation(api.games.advanceRound);
  const previousRound = useMutation(api.games.previousRound);
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

  const firstRound = useQuery(
    api.games.getRoundByNumber,
    game ? { gameId: game._id, roundNumber: 1 } : "skip"
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

  // Manual navigation - auto-advance disabled
  // Use forward/backward buttons to control slideshow

  // Show "New Round?" button on last slide after reveal (immediately)
  useEffect(() => {
    if (game && game.currentRound === game.totalRounds && currentRound?.round.revealedAt) {
      setShowNewGameButton(true);
    } else {
      setShowNewGameButton(false);
    }
  }, [game?.currentRound, game?.totalRounds, currentRound?.round.revealedAt]);

  // Watch for new users joining and show notification
  useEffect(() => {
    if (roomUsers && roomUsers.length > lastUserCount && lastUserCount >= 0) {
      // New user joined - find the newest user
      const newUser = roomUsers[roomUsers.length - 1];

      // Generate random position (safe zones: 10-90% width, 20-70% height to avoid bottom controls)
      const x = 10 + Math.random() * 80; // 10-90%
      const y = 20 + Math.random() * 50; // 20-70%

      const notificationId = `${Date.now()}-${Math.random()}`;

      // Add notification to array
      setJoinNotifications(prev => [...prev, {
        id: notificationId,
        avatar: newUser.avatar,
        x,
        y,
      }]);

      // Remove notification after 2 seconds
      setTimeout(() => {
        setJoinNotifications(prev => prev.filter(n => n.id !== notificationId));
      }, 2000);
    }

    if (roomUsers) {
      setLastUserCount(roomUsers.length);
    }
  }, [roomUsers, lastUserCount]);

  // Initialize dark mode
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored === "dark" || (!stored && prefersDark);
    setIsDark(shouldBeDark);

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setSettingsOpen(false);
  };

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
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleAdjustTime = async (minutes: number) => {
    if (!roomId || !pin) return;

    try {
      await adjustPhase1Duration({
        roomId: roomId as Id<"rooms">,
        pin,
        adjustmentSeconds: minutes * 60
      });
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
      // Ensure current round is revealed before advancing
      if (currentRound && !currentRound.round.revealedAt) {
        await revealRound({ gameId: game._id });
      }
      // Advance to next slide
      await advanceRound({ gameId: game._id });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleRevealComplete = useCallback(async () => {
    if (!game || !currentRound || currentRound.round.revealedAt) return;

    try {
      // Save reveal state to database
      await revealRound({ gameId: game._id });
    } catch (error: any) {
      console.error("Error saving reveal:", error);
    }
  }, [game, currentRound, revealRound]);

  const handlePreviousSlide = async () => {
    if (!game) return;

    try {
      await previousRound({ gameId: game._id });
    } catch (error: any) {
      // Silently ignore "already at first round" errors
      if (!error.message.includes("Already at first round")) {
        showToast(error.message, "error");
      }
    }
  };

  const handleToggleSlideshow = async () => {
    if (!roomId) return;

    // If game exists and is in progress, stop it
    if (game && game.status === "in_progress") {
      try {
        await endGame({ gameId: game._id });
      } catch (error: any) {
        showToast(error.message, "error");
      }
    } else {
      // Start or restart the slideshow
      try {
        const result = await generateGame({ roomId: roomId as Id<"rooms"> });
        await startGame({ gameId: result.gameId });
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
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
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
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
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
                className="w-full px-8 py-6 text-xl font-semibold text-white bg-success text-white rounded-xl hover:opacity-90 transition shadow-lg"
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
                            ? "bg-gradient-to-br from-primary-600 to-accent-600 hover:bg-blue-700 text-white"
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
                className="w-full px-8 py-6 text-xl font-semibold text-white bg-success text-white rounded-xl hover:opacity-90 transition shadow-lg"
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
                            ? "bg-gradient-to-br from-primary-600 to-accent-600 hover:bg-blue-700 text-white"
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

  // Manage view - Always fullscreen
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

    // State 1: Ready to Start Game (Phase 1 not started yet)
    if (!room.phase1StartedAt) {
      return (
        <div className="fixed inset-0 z-50 bg-background overflow-hidden">
          {/* Settings in top-right */}
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6 text-foreground" />
            </button>

            {/* Settings Dropdown */}
            <AnimatePresence>
              {settingsOpen && (
                <>
                  <div onClick={() => setSettingsOpen(false)} className="fixed inset-0 z-40" />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-14 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                  >
                    <button
                      onClick={toggleDarkMode}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-foreground">
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {isDark ? "Light Mode" : "Dark Mode"}
                      </span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <main className="flex min-h-screen flex-col items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-16"
            >
              {/* URL and Room Code */}
              <div className="text-center">
                <div className="text-3xl text-muted-foreground font-medium mb-3">
                  https://joinroom.link
                </div>
                <div className="text-6xl font-display font-bold text-foreground uppercase tracking-[0.25em] -mr-[0.25em]">
                  {roomCode}
                </div>
              </div>

              {/* Timer with controls */}
              <div className="flex items-center justify-center gap-6 mb-8">
                {/* Invisible spacer for visual balance */}
                <div className="w-12 flex flex-col gap-2 invisible" aria-hidden="true">
                  <div className="h-12"></div>
                  <div className="h-12"></div>
                </div>

                <div className="text-9xl font-bold tabular-nums text-foreground">
                  {Math.floor(room.phase1Duration / 60).toString().padStart(2, "0")}:{(room.phase1Duration % 60).toString().padStart(2, "0")}
                </div>

                {/* Time adjustment - to the right of clock */}
                <div className="flex flex-col gap-2">
                  {/* Increase time button */}
                  <button
                    onClick={() => handleAdjustTime(1)}
                    disabled={room.phase1Duration >= 1200}
                    className="w-12 h-12 flex items-center justify-center bg-muted/50 hover:bg-muted text-foreground rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                    aria-label="Increase time by 1 minute"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>

                  {/* Decrease time button */}
                  <button
                    onClick={() => handleAdjustTime(-1)}
                    disabled={room.phase1Duration <= 60}
                    className="w-12 h-12 flex items-center justify-center bg-muted/50 hover:bg-muted text-foreground rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                    aria-label="Decrease time by 1 minute"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Participant count - centered below clock */}
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <Users className="w-6 h-6" />
                  <span>{roomUsers?.length || 0}</span>
                </div>
              </div>

            </motion.div>
          </main>

          {/* Game Controls - Bottom */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={handleStartPhase1}
              className="w-20 h-20 flex items-center justify-center bg-gradient-to-br from-primary-600 to-accent-600 dark:from-primary-500 dark:to-accent-500 text-white rounded-full hover:from-primary-700 hover:to-accent-700 dark:hover:from-primary-600 dark:hover:to-accent-600 transition-all shadow-2xl hover:shadow-3xl hover:scale-110 active:scale-95"
              aria-label="Start game"
            >
              <Play className="w-10 h-10 ml-1" />
            </button>
          </div>

          {/* Join notifications - random positions */}
          <div className="fixed inset-0 z-50 pointer-events-none">
            <AnimatePresence>
              {joinNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    left: `${notification.x}%`,
                    top: `${notification.y}%`,
                  }}
                  className="w-24 h-24 rounded-full bg-card/80 border border-border shadow-lg flex items-center justify-center text-5xl pointer-events-none"
                >
                  {notification.avatar}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      );
    }

    // State 2: Phase 1 Active
    if (room.phase1Active) {
      return (
        <div className="fixed inset-0 z-50 bg-background overflow-hidden">
          {/* Settings in top-right */}
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6 text-foreground" />
            </button>

            {/* Settings Dropdown */}
            <AnimatePresence>
              {settingsOpen && (
                <>
                  <div onClick={() => setSettingsOpen(false)} className="fixed inset-0 z-40" />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-14 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                  >
                    <button
                      onClick={toggleDarkMode}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-foreground">
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {isDark ? "Light Mode" : "Dark Mode"}
                      </span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <main className="flex min-h-screen flex-col items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-16"
            >
              {/* URL and Room Code */}
              <div className="text-center">
                <div className="text-3xl text-muted-foreground font-medium mb-3">
                  https://joinroom.link
                </div>
                <div className="text-6xl font-display font-bold text-foreground uppercase tracking-[0.25em] -mr-[0.25em]">
                  {roomCode}
                </div>
              </div>

              {/* Timer with controls */}
              <div className="flex items-center justify-center gap-8 mb-8">
                {/* Invisible spacer for visual balance */}
                <div className="w-12 flex flex-col gap-2 invisible" aria-hidden="true">
                  <div className="h-12"></div>
                  <div className="h-12"></div>
                </div>

                <div className={`text-9xl font-bold tabular-nums ${room.windingDownStartedAt ? 'text-orange-500' : 'text-foreground'}`}>
                  {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </div>

                {/* Time adjustment - to the right of clock */}
                <div className="flex flex-col gap-2">
                  {/* Increase time button */}
                  <button
                    onClick={() => handleAdjustTime(1)}
                    disabled={room.phase1Duration >= 1200 || !!room.windingDownStartedAt}
                    className="w-12 h-12 flex items-center justify-center bg-muted/50 hover:bg-muted text-foreground rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                    aria-label="Increase time by 1 minute"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>

                  {/* Decrease time button */}
                  <button
                    onClick={() => handleAdjustTime(-1)}
                    disabled={timeRemaining < 60 || !!room.windingDownStartedAt}
                    className="w-12 h-12 flex items-center justify-center bg-muted/50 hover:bg-muted text-foreground rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                    aria-label="Decrease time by 1 minute"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Participant count - centered below clock */}
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <Users className="w-6 h-6" />
                  <span>{roomUsers?.length || 0}</span>
                </div>
              </div>

            </motion.div>
          </main>

          {/* Join notifications - random positions */}
          <div className="fixed inset-0 z-50 pointer-events-none">
            <AnimatePresence>
              {joinNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    left: `${notification.x}%`,
                    top: `${notification.y}%`,
                  }}
                  className="w-24 h-24 rounded-full bg-card/80 border border-border shadow-lg flex items-center justify-center text-5xl pointer-events-none"
                >
                  {notification.avatar}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      );
    }

    // State 3 & 4: Slideshow (Ready or Playing)
    // Determine which slideshow state we're in
    const slideshowReady = room.phase1StartedAt && !room.phase1Active && (!game || game.status !== "in_progress");
    const slideshowPlaying = game && game.status === "in_progress";
    const isLastSlide = game && game.currentRound === game.totalRounds;
    const isLastSlideRevealed = isLastSlide && currentRound?.round.revealedAt;

    if (slideshowReady || slideshowPlaying) {
      const displayRound = game && game.status === "in_progress" && currentRound
        ? currentRound
        : firstRound;

      return (
        <div className="fixed inset-0 z-50 bg-background overflow-hidden">
          {/* Settings in top-right */}
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6 text-foreground" />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <>
                  <div onClick={() => setSettingsOpen(false)} className="fixed inset-0 z-40" />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-14 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                  >
                    <button
                      onClick={toggleDarkMode}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-foreground">
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {isDark ? "Light Mode" : "Dark Mode"}
                      </span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Room Code - Top Center */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-center">
            <div className="text-3xl font-display font-bold text-foreground uppercase tracking-[0.5em]">
              {roomCode}
            </div>
            {game && displayRound && game.status === "in_progress" && (
              <div className="text-xl text-muted-foreground mt-2">
                {displayRound.round.roundNumber} / {game.totalRounds}
              </div>
            )}
            {room && (
              <div className="text-sm text-muted-foreground mt-1">
                Round {room.roundNumber}
              </div>
            )}
          </div>

          {/* Slideshow Content */}
          <main className="flex min-h-screen flex-col items-center justify-center p-12 overflow-hidden relative">
            {game?.status === "in_progress" && displayRound?.questionData ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayRound.round.roundNumber}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.4, 0.0, 0.2, 1]
                  }}
                  className="w-full max-w-6xl"
                >
                  <SlideshowQuestion
                    questionText={displayRound.questionData.text || displayRound.round.questionText}
                    optionA={displayRound.questionData.optionA}
                    optionB={displayRound.questionData.optionB}
                    percentA={displayRound.questionData.percentA}
                    percentB={displayRound.questionData.percentB}
                    totalResponses={displayRound.questionData.totalResponses}
                    isRevealed={!!displayRound.round.revealedAt}
                    roundNumber={displayRound.round.roundNumber}
                    variant="projector"
                    onRevealComplete={handleRevealComplete}
                  />
                </motion.div>
              </AnimatePresence>
            ) : slideshowReady && firstRound?.questionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-6xl"
              >
                <SlideshowQuestion
                  questionText={firstRound.questionData.text || firstRound.round.questionText}
                  optionA={firstRound.questionData.optionA}
                  optionB={firstRound.questionData.optionB}
                  percentA={firstRound.questionData.percentA}
                  percentB={firstRound.questionData.percentB}
                  totalResponses={firstRound.questionData.totalResponses}
                  isRevealed={false}
                  roundNumber={1}
                  variant="projector"
                  isPreview={true}
                />
              </motion.div>
            ) : slideshowReady && !firstRound?.questionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-8"
              >
                <div className="text-5xl font-bold text-foreground">No responses collected</div>
              </motion.div>
            ) : null}

          </main>

          {/* "New Round?" Button - Bottom Right (Last Slide After Reveal) */}
          <AnimatePresence>
            {showNewGameButton && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: "Start New Round?",
                    message: "This will reset all game data and start fresh.",
                  });
                  if (confirmed && roomId && pin && room) {
                    try {
                      // Reset duration to 10 minutes (600 seconds)
                      const targetDuration = 600;
                      const adjustment = targetDuration - room.phase1Duration;
                      if (adjustment !== 0) {
                        await adjustPhase1Duration({
                          roomId: roomId as Id<"rooms">,
                          pin: pin,
                          adjustmentSeconds: adjustment,
                        });
                      }

                      await resetRoom({
                        roomId: roomId as Id<"rooms">,
                        pin: pin,
                      });
                      showToast("Ready to start a new session");
                    } catch (error: any) {
                      showToast(error.message, "error");
                    }
                  }
                }}
                className="fixed bottom-8 right-8 z-50 w-20 h-20 flex items-center justify-center bg-gradient-to-br from-accent-600 to-primary-600 dark:from-accent-500 dark:to-primary-500 text-white rounded-full hover:from-accent-700 hover:to-primary-700 dark:hover:from-accent-600 dark:hover:to-primary-600 transition-all shadow-2xl hover:shadow-3xl hover:scale-110 active:scale-95"
                aria-label="Start new round"
              >
                <ArrowRight className="w-10 h-10" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Control Buttons - Bottom Center */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-4">
            {slideshowReady && firstRound?.questionData && (
              <button
                onClick={handleToggleSlideshow}
                className="w-20 h-20 flex items-center justify-center bg-gradient-to-br from-primary-600 to-accent-600 dark:from-primary-500 dark:to-accent-500 text-white rounded-full hover:from-primary-700 hover:to-accent-700 dark:hover:from-primary-600 dark:hover:to-accent-600 transition-all shadow-2xl hover:shadow-3xl hover:scale-110 active:scale-95"
                aria-label="Start slideshow"
              >
                <Play className="w-10 h-10 ml-1" />
              </button>
            )}
            {slideshowReady && !firstRound?.questionData && (
              <button
                onClick={async () => {
                  if (!roomId || !pin || !room) return;
                  try {
                    // Reset duration to 10 minutes (600 seconds)
                    const targetDuration = 600;
                    const adjustment = targetDuration - room.phase1Duration;
                    if (adjustment !== 0) {
                      await adjustPhase1Duration({
                        roomId: roomId as Id<"rooms">,
                        pin: pin,
                        adjustmentSeconds: adjustment,
                      });
                    }

                    await resetRoom({
                      roomId: roomId as Id<"rooms">,
                      pin: pin,
                    });
                    showToast("Ready to start a new session");
                  } catch (error: any) {
                    showToast(error.message, "error");
                  }
                }}
                className="w-20 h-20 flex items-center justify-center bg-gradient-to-br from-accent-600 to-primary-600 dark:from-accent-500 dark:to-primary-500 text-white rounded-full hover:from-accent-700 hover:to-primary-700 dark:hover:from-accent-600 dark:hover:to-primary-600 transition-all shadow-2xl hover:shadow-3xl hover:scale-110 active:scale-95"
                aria-label="Start new round"
              >
                <ArrowRight className="w-10 h-10" />
              </button>
            )}
            {game && game.status === "in_progress" && (
              <>
                <button
                  onClick={handlePreviousSlide}
                  disabled={game.currentRound <= 1}
                  className="w-20 h-20 flex items-center justify-center bg-muted/50 hover:bg-muted/70 text-foreground rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                {/* Hide forward button on last slide */}
                {game.currentRound < game.totalRounds && (
                  <button
                    onClick={handleNextSlide}
                    className="w-20 h-20 flex items-center justify-center bg-muted/50 hover:bg-muted/70 text-foreground rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-10 h-10" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    // Fallback (shouldn't reach here)
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return null;
}
