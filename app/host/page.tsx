"use client";

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";
import { Maximize, Minimize, Play, Pause, Square, Snowflake, Plus, Minus, Users, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer, Screen } from "@/components/layout/Page";
import { TitleBar } from "@/components/TitleBar";

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

  const createRoom = useMutation(api.rooms.createRoom);
  const startPhase1 = useMutation(api.rooms.startPhase1);
  const stopPhase1 = useMutation(api.rooms.stopPhase1);
  const adjustPhase1Duration = useMutation(api.rooms.adjustPhase1Duration);
  const seedQuestions = useMutation(api.questions.seedQuestions);
  const removeUser = useMutation(api.users.removeUser);

  // Phase 2 mutations
  const generateGame = useMutation(api.games.generateGame);
  const startGame = useMutation(api.games.startGame);
  const revealRound = useMutation(api.games.revealRound);
  const advanceRound = useMutation(api.games.advanceRound);
  const previousRound = useMutation(api.games.previousRound);
  const endGame = useMutation(api.games.endGame);
  const setSlideStage = useMutation(api.games.setSlideStage);
  const advanceSlide = useMutation(api.games.advanceSlide);
  const closeRoom = useMutation(api.rooms.closeRoom);

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

  // Slideshow auto-timer (host-driven)
  // Runs when game is in progress and manages stage transitions
  useEffect(() => {
    if (!game || game.status !== "in_progress" || !game.stage || !game.stageStartedAt) {
      return;
    }

    // If slideshow is finished, don't run timer
    if (game.isFinished) {
      return;
    }

    const now = Date.now();
    const elapsed = now - game.stageStartedAt;
    const STAGE_DURATION = 6000; // 6 seconds per stage
    const TOLERANCE = 250; // 250ms tolerance to avoid jitter

    let timeoutId: NodeJS.Timeout;

    if (game.stage === "pre_reveal") {
      // In pre_reveal stage: wait 6s then transition to revealed
      const remaining = Math.max(0, STAGE_DURATION - elapsed);
      
      if (remaining <= TOLERANCE) {
        // Transition immediately if we're already past the deadline
        setSlideStage({ gameId: game._id, stage: "revealed" }).catch(console.error);
      } else {
        timeoutId = setTimeout(() => {
          setSlideStage({ gameId: game._id, stage: "revealed" }).catch(console.error);
        }, remaining);
      }
    } else if (game.stage === "revealed") {
      // Don't auto-advance if this is the last round
      if (game.currentRound >= game.totalRounds) {
        return;
      }

      // In revealed stage: wait 6s then advance to next slide
      const remaining = Math.max(0, STAGE_DURATION - elapsed);

      if (remaining <= TOLERANCE) {
        // Advance immediately if we're already past the deadline
        advanceSlide({ gameId: game._id }).catch(console.error);
      } else {
        timeoutId = setTimeout(() => {
          advanceSlide({ gameId: game._id }).catch(console.error);
        }, remaining);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [game?.stage, game?.stageStartedAt, game?.isFinished, game?._id, game?.status, setSlideStage, advanceSlide]);

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

  const handleCloseRoom = async () => {
    if (!roomId || !pin) return;

    const confirmed = await showConfirm({
      title: "Close Room?",
      message: "This will end the session and remove all players from the room. This action cannot be undone.",
      confirmText: "Close Room",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      await closeRoom({ roomId: roomId as Id<"rooms">, pin });
      // Clear local storage
      localStorage.removeItem(ROOM_STORAGE_KEY);
      // Navigate back to create view
      window.location.href = "/host";
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Create view
  if (view === "create") {
    const selectStyle: CSSProperties = {
      backgroundImage:
        "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
      backgroundPosition: "right 1rem center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "1.25em 1.25em",
    };

    const renderAdvancedOptions = () => (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-base font-semibold text-foreground shadow-sm focus:border-success focus:outline-none sm:px-5 sm:py-4 sm:text-lg"
            style={selectStyle}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            Max group size
          </label>
          <select
            value={maxGroupSize}
            onChange={(e) => setMaxGroupSize(parseInt(e.target.value))}
            className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-base font-semibold text-foreground shadow-sm focus:border-success focus:outline-none sm:px-5 sm:py-4 sm:text-lg"
            style={selectStyle}
          >
            <option value={2}>2 people</option>
            <option value={3}>3 people</option>
            <option value={4}>4 people</option>
            <option value={5}>5 people</option>
            <option value={6}>6 people</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            Join existing room
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={joinPin}
              onChange={(e) => setJoinPin(e.target.value.slice(0, 4))}
              placeholder="4-digit PIN"
              className="flex-1 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-center text-lg font-semibold tracking-[0.5em] text-foreground focus:border-primary focus:outline-none sm:px-5 sm:py-4 sm:text-xl"
              maxLength={4}
              inputMode="numeric"
            />
            <button
              onClick={handleJoinByPin}
              disabled={joinPin.length !== 4 || !roomByPin}
              className="w-full rounded-2xl bg-gradient-to-r from-primary-600 to-accent-600 px-6 py-3 text-lg font-semibold text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:opacity-60 sm:w-auto sm:px-8 sm:py-4"
            >
              Join
            </button>
          </div>
          {joinPin.length === 4 && !roomByPin && roomByPin !== undefined && (
            <p className="text-sm font-medium text-red-600">
              Room not found with that PIN
            </p>
          )}
        </div>
      </motion.div>
    );

    // Show loading state while validating saved room
    if (validatingSavedRoom) {
      return (
        <Screen
          as="main"
          padding="compact"
          innerClassName="items-center justify-center"
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <LoadingSpinner
              size="lg"
              color="border-green-200 border-t-green-600"
            />
          </motion.div>
        </Screen>
      );
    }

    return (
      <Screen
        as="main"
        padding="compact"
        innerClassName="items-center justify-center"
      >
        <PageContainer size="sm" align="center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-8 sm:space-y-10"
          >
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                Ice
              </h1>
            </div>

            <div className="space-y-8">
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleCreateRoom}
                  className="w-full rounded-3xl bg-gradient-to-r from-success to-success/80 px-6 py-4 text-lg font-semibold text-white shadow-[0_25px_45px_rgba(34,197,94,0.25)] transition hover:translate-y-0.5 hover:opacity-95 sm:text-xl"
                >
                  Create a New Room
                </button>

                {validatedRoom && (
                  <button
                    onClick={handleContinueToRoom}
                    className="w-full rounded-3xl bg-white/80 px-6 py-4 text-lg font-semibold text-foreground shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-border/40 transition hover:-translate-y-0.5 hover:bg-white sm:text-xl dark:bg-white/10 dark:text-white dark:ring-white/15"
                  >
                    Resume room {validatedRoom.roomCode}
                  </button>
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowOptions(!showOptions)}
                  className="font-semibold text-primary"
                >
                  {showOptions ? "Hide options" : "Options"}
                </motion.button>
              </div>

              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-[32px] bg-muted/30 p-5 sm:p-6 backdrop-blur-md"
                  >
                    {renderAdvancedOptions()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </PageContainer>
      </Screen>
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
          <TitleBar />

          {/* URL and Room Code - Fixed below title bar */}
          <div className="fixed top-16 left-0 right-0 z-40 text-center py-4 bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="text-2xl text-muted-foreground font-medium mb-2">
              https://joinroom.link
            </div>
            <div className="text-5xl font-display font-bold text-foreground uppercase tracking-[0.25em] -mr-[0.25em]">
              {roomCode}
            </div>
          </div>

          <main className="flex min-h-screen flex-col items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-16"
            >

              {/* Timer with controls */}
              <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-12 lg:gap-16 mb-8">
                {/* Decrease time button - left side */}
                <button
                  onClick={() => handleAdjustTime(-1)}
                  disabled={room.phase1Duration <= 60}
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center text-foreground/20 hover:text-foreground/30 bg-foreground/5 hover:bg-foreground/10 rounded-full transition-all hover:scale-105 active:scale-95 active:ring-2 active:ring-foreground/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Decrease time by 1 minute"
                >
                  <Minus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </button>

                <div className="text-7xl sm:text-8xl md:text-9xl lg:text-9xl xl:text-9xl font-bold tabular-nums text-foreground">
                  {Math.floor(room.phase1Duration / 60).toString().padStart(2, "0")}:{(room.phase1Duration % 60).toString().padStart(2, "0")}
                </div>

                {/* Increase time button - right side */}
                <button
                  onClick={() => handleAdjustTime(1)}
                  disabled={room.phase1Duration >= 1200}
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center text-foreground/20 hover:text-foreground/30 bg-foreground/5 hover:bg-foreground/10 rounded-full transition-all hover:scale-105 active:scale-95 active:ring-2 active:ring-foreground/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Increase time by 1 minute"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </button>
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
          <TitleBar />

          {/* URL and Room Code - Fixed below title bar */}
          <div className="fixed top-16 left-0 right-0 z-40 text-center py-4 bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="text-2xl text-muted-foreground font-medium mb-2">
              https://joinroom.link
            </div>
            <div className="text-5xl font-display font-bold text-foreground uppercase tracking-[0.25em] -mr-[0.25em]">
              {roomCode}
            </div>
          </div>

          <main className="flex min-h-screen flex-col items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-16"
            >

              {/* Timer with controls */}
              <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-12 lg:gap-16 mb-8">
                {/* Decrease time button - left side */}
                <button
                  onClick={() => handleAdjustTime(-1)}
                  disabled={timeRemaining < 60 || !!room.windingDownStartedAt}
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center text-foreground/20 hover:text-foreground/30 bg-foreground/5 hover:bg-foreground/10 rounded-full transition-all hover:scale-105 active:scale-95 active:ring-2 active:ring-foreground/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Decrease time by 1 minute"
                >
                  <Minus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </button>

                <div className={`text-7xl sm:text-8xl md:text-9xl lg:text-9xl xl:text-9xl font-bold tabular-nums ${room.windingDownStartedAt ? 'text-orange-500' : 'text-foreground'}`}>
                  {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </div>

                {/* Increase time button - right side */}
                <button
                  onClick={() => handleAdjustTime(1)}
                  disabled={room.phase1Duration >= 1200 || !!room.windingDownStartedAt}
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center text-foreground/20 hover:text-foreground/30 bg-foreground/5 hover:bg-foreground/10 rounded-full transition-all hover:scale-105 active:scale-95 active:ring-2 active:ring-foreground/20 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Increase time by 1 minute"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </button>
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
          <TitleBar />

          {/* Room Code - Fixed below title bar */}
          <div className="fixed top-16 left-0 right-0 z-40 text-center py-1 sm:py-4 bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="text-3xl font-display font-bold text-foreground uppercase tracking-[0.5em]">
              {roomCode}
            </div>
            {game && displayRound && game.status === "in_progress" && (
              <div className="text-xl text-muted-foreground mt-1 sm:mt-2">
                {displayRound.round.roundNumber} / {game.totalRounds}
              </div>
            )}
          </div>

          {/* Slideshow Content */}
          <main className="flex min-h-[100vh] flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 py-4 overflow-hidden relative text-center">
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
                  className="w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl"
                >
                  <SlideshowQuestion
                    key={`${displayRound.round.roundNumber}-${game.stage}`}
                    questionText={displayRound.questionData.text || displayRound.round.questionText}
                    optionA={displayRound.questionData.optionA}
                    optionB={displayRound.questionData.optionB}
                    percentA={displayRound.questionData.percentA}
                    percentB={displayRound.questionData.percentB}
                    totalResponses={displayRound.questionData.totalResponses}
                    isRevealed={game.stage === "revealed"}
                    roundNumber={displayRound.round.roundNumber}
                    variant="projector"
                  />
                </motion.div>
              </AnimatePresence>
            ) : slideshowReady && firstRound?.questionData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl"
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
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">No responses collected</div>
              </motion.div>
            ) : null}

          </main>

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
            {game && game.isFinished && (
              <button
                onClick={handleCloseRoom}
                className="px-8 py-4 flex items-center gap-3 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-full hover:from-red-700 hover:to-red-800 transition-all shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 text-lg font-semibold"
                aria-label="Close room"
              >
                <Square className="w-6 h-6" />
                Exit / Close Room
              </button>
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
