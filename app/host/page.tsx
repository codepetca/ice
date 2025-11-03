"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEmojiName } from "@/lib/avatars";

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

  // Create view
  if (view === "create") {
    // Show loading state while validating saved room
    if (validatingSavedRoom) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-6"
          >
            <div className="text-6xl">🔄</div>
            <p className="text-xl text-gray-600">Checking saved room...</p>
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
      ? Math.floor((currentTime - room.windingDownStartedAt) / 1000)
      : 0;
    const windingDownRemaining = Math.max(0, 15 - windingDownElapsed);

    // Use winding down time if in winding down mode, otherwise use normal time
    const timeElapsed = room.phase1StartedAt && room.phase1Active
      ? Math.floor((currentTime - room.phase1StartedAt) / 1000)
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
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Users in Room
              </h3>

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
        </motion.div>
      </main>
    );
  }

  return null;
}
