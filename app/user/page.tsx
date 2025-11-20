"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMachine } from "@xstate/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { userMachine } from "@/lib/userStateMachine";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { getRandomAvatars } from "@/lib/avatars";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";
import { TitleBar } from "@/components/TitleBar";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { WaitingScreen } from "@/components/WaitingScreen";
import RoundProgressBar from "@/components/RoundProgressBar";
import { NameMatchingUI } from "@/components/NameMatchingUI";

function UserPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [state, send] = useMachine(userMachine);
  const [roomCode] = useState(searchParams.get("roomCode") || "");
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinStep, setJoinStep] = useState<"name" | "avatar">("name");
  const [checkingSession, setCheckingSession] = useState(true);
  const hasCheckedSessionRef = useRef(false);

  // Mutations
  const joinRoom = useMutation(api.users.joinRoom);
  const rejoinRoom = useMutation(api.users.rejoinRoom);
  const submitNameSelection = useMutation(api.groups.submitNameSelection);
  const validateNameMatching = useMutation(api.groups.validateNameMatching);
  const submitAnswer = useMutation(api.groups.submitAnswer);
  const submitVote = useMutation(api.games.submitVote);
  const leaveRoom = useMutation(api.users.leaveRoom);

  // Queries
  const validateUserSession = useQuery(
    api.users.validateUserSession,
    state.context.userId && roomCode
      ? { userId: state.context.userId as Id<"users">, roomCode }
      : "skip"
  );

  const currentGroup = useQuery(
    api.groups.getCurrentGroup,
    state.context.userId ? { userId: state.context.userId as Id<"users"> } : "skip"
  );

  const room = useQuery(
    api.rooms.getRoomById,
    state.context.roomId ? { roomId: state.context.roomId as Id<"rooms"> } : "skip"
  );

  const takenAvatars = useQuery(
    api.users.getTakenAvatars,
    roomCode ? { roomCode } : "skip"
  );

  // Phase 2 queries
  const game = useQuery(
    api.games.getGameByRoom,
    state.context.roomId ? { roomId: state.context.roomId as Id<"rooms"> } : "skip"
  );

  const gameState = useQuery(
    api.games.getGameState,
    game ? { gameId: game._id } : "skip"
  );

  const currentRound = useQuery(
    api.games.getCurrentRound,
    game ? { gameId: game._id } : "skip"
  );

  const userScore = useQuery(
    api.games.getUserScore,
    game && state.context.userId
      ? { gameId: game._id, userId: state.context.userId as Id<"users"> }
      : "skip"
  );

  const hasVoted = useQuery(
    api.games.hasVotedThisRound,
    game && state.context.userId
      ? { gameId: game._id, userId: state.context.userId as Id<"users"> }
      : "skip"
  );

  const leaderboard = useQuery(
    api.games.getLeaderboard,
    game && game.status === "completed" ? { gameId: game._id } : "skip"
  );

  // Check for existing session in localStorage on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      if (!roomCode) {
        setCheckingSession(false);
        return;
      }

      if (hasCheckedSessionRef.current) {
        return;
      }
      hasCheckedSessionRef.current = true;

      try {
        const savedSession = localStorage.getItem(`ice_user_${roomCode}`);
        if (!savedSession) {
          setCheckingSession(false);
          return;
        }

        const sessionData = JSON.parse(savedSession);
        const { userId } = sessionData;

        const result = await rejoinRoom({ userId, roomCode });

        send({
          type: "JOIN_ROOM",
          userId: result.userId,
          roomId: result.roomId,
          code: result.code,
          displayName: result.displayName,
          avatar: result.avatar,
        });

        showToast("Welcome back!", "success");
      } catch (error: any) {
        localStorage.removeItem(`ice_user_${roomCode}`);
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate avatar options
  useEffect(() => {
    if (takenAvatars && avatarOptions.length === 0) {
      const available = getRandomAvatars(3, takenAvatars);
      setAvatarOptions(available);
    }
  }, [takenAvatars, avatarOptions.length]);

  // Check if session is locked
  useEffect(() => {
    if (
      room &&
      !room.phase1Active &&
      room.phase1StartedAt &&
      (state.matches("waiting_for_round_start") || state.matches("name_matching") || state.matches("question_active"))
    ) {
      send({ type: "SESSION_LOCKED" });
    }
  }, [room, state, send]);

  // Phase 2: Monitor game start
  useEffect(() => {
    if (
      game &&
      game.status === "in_progress" &&
      state.matches("session_locked") &&
      currentRound
    ) {
      send({
        type: "START_PHASE2",
        gameId: game._id,
        roundNumber: currentRound.round.roundNumber,
        questionText: currentRound.round.questionText,
      });
    }
  }, [game, currentRound, state, send]);

  // Phase 2: Auto-transition to waiting after voting
  useEffect(() => {
    if (state.matches("phase2_voting") && hasVoted === true) {
      send({ type: "SUBMIT_VOTE", choice: "dummy" });
    }
  }, [hasVoted, state, send]);

  // Phase 2: Monitor round advancement
  useEffect(() => {
    if (state.matches("phase2_waiting") && gameState?.game) {
      const currentInState = state.context.currentRoundNumber;
      const currentInGame = gameState.game.currentRound;

      if (currentInGame > currentInState!) {
        if (currentRound) {
          send({
            type: "NEXT_ROUND",
            roundNumber: currentRound.round.roundNumber,
            questionText: currentRound.round.questionText,
          });
        }
      }
    }
  }, [gameState, currentRound, state, send]);

  // Phase 2: Monitor game completion
  useEffect(() => {
    if (
      game &&
      game.status === "completed" &&
      (state.matches("phase2_reveal") || state.matches("phase2_waiting") || state.matches("phase2_voting"))
    ) {
      send({ type: "GAME_COMPLETE" });
    }
  }, [game, state, send]);

  // Phase 2: Monitor room reset
  useEffect(() => {
    if (
      room &&
      !room.phase1StartedAt &&
      (state.matches("phase2_reveal") ||
       state.matches("phase2_waiting") ||
       state.matches("phase2_voting") ||
       state.matches("phase2_complete"))
    ) {
      send({ type: "ROOM_RESET" });
      showToast("Room reset", "info");
    }
  }, [room?.phase1StartedAt, state, send, showToast]);

  // Monitor group status - detect when group is assigned or round ends
  useEffect(() => {
    if (!state.context.userId) return;

    // Check if we're in waiting_for_round_start and group is assigned
    if (state.matches("waiting_for_round_start") && currentGroup?.groupId) {
      const myUserId = state.context.userId;
      const nameChoices = currentGroup.nameChoicesByPlayer?.[myUserId] || {};

      send({
        type: "START_NAME_MATCHING",
        groupId: currentGroup.groupId,
        members: currentGroup.members.filter((m: any) => m.userId !== myUserId),
        nameChoices,
      });
    }

    // Check if we're in name_matching and group advanced to WYR
    if (state.matches("name_matching") && currentGroup?.phase === "wyr" && currentGroup?.question) {
      send({
        type: "ADVANCE_TO_WYR",
        question: currentGroup.question,
      });
    }
  }, [currentGroup, state, send]);

  // Monitor round changes and trigger ROUND_END event
  const prevRoundRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!room || !room.phase1Active) {
      prevRoundRef.current = undefined;
      return;
    }

    if (prevRoundRef.current !== undefined && room.currentRound !== prevRoundRef.current) {
      if (state.matches("question_active") || state.matches("name_matching")) {
        send({ type: "ROUND_END" });
        showToast("New round starting!", "info");
      }
    }

    prevRoundRef.current = room.currentRound;
  }, [room, room?.currentRound, state, send, showToast]);

  // Handle joining room
  const handleJoinRoom = async () => {
    if (!roomCode || !selectedAvatar || !displayName.trim()) return;

    try {
      const result = await joinRoom({
        roomCode,
        displayName: displayName.trim(),
        avatar: selectedAvatar,
      });

      send({
        type: "JOIN_ROOM",
        userId: result.userId,
        roomId: result.roomId,
        code: result.code,
        displayName: displayName.trim(),
        avatar: selectedAvatar,
      });

      localStorage.setItem(
        `ice_user_${roomCode}`,
        JSON.stringify({
          userId: result.userId,
          avatar: selectedAvatar,
          displayName: displayName.trim(),
          code: result.code,
          roomId: result.roomId,
          lastJoined: Date.now(),
        })
      );
    } catch (error: any) {
      showToast(error.message, "error");
      if (error.message === "Room not found") {
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    }
  };

  // Auto-join when avatar is selected
  useEffect(() => {
    if (selectedAvatar && displayName.trim() && !state.context.userId) {
      handleJoinRoom();
    }
  }, [selectedAvatar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle name matching validation
  const handleNameMatchingSubmit = async (selections: Record<string, string>) => {
    if (!state.context.userId || !currentGroup?.groupId) {
      return { success: false };
    }

    try {
      // Submit all selections
      for (const [targetUserId, selectedName] of Object.entries(selections)) {
        await submitNameSelection({
          groupId: currentGroup.groupId as Id<"groups">,
          userId: state.context.userId as Id<"users">,
          targetUserId: targetUserId as Id<"users">,
          selectedName,
        });
      }

      // Validate (this marks us as submitted, validates only when all submit)
      const result = await validateNameMatching({
        groupId: currentGroup.groupId as Id<"groups">,
        userId: state.context.userId as Id<"users">,
      });

      if (result.waitingForOthers) {
        showToast(`Submitted! Waiting for ${result.totalCount - result.submittedCount} more...`, "info");
        return { success: true, waitingForOthers: true };
      }

      if (result.validated) {
        if (result.allCorrect) {
          showToast("Everyone got it! Moving to question...", "success");
          return { success: true };
        } else if (result.success) {
          showToast("You got them all correct! Waiting for others to retry...", "success");
          return { success: true };
        } else {
          showToast("Some names were wrong - check the highlighted ones", "error");
          return { success: false, incorrectAvatars: result.incorrectAvatars };
        }
      }

      return result;
    } catch (error: any) {
      showToast(error.message, "error");
      return { success: false };
    }
  };

  // Handle answer submission
  const handleSubmitAnswer = async (choice: string) => {
    if (!choice || !currentGroup?.groupId || !state.context.userId) return;

    try {
      await submitAnswer({
        userId: state.context.userId as Id<"users">,
        groupId: currentGroup.groupId as Id<"groups">,
        choice,
      });
      send({ type: "SUBMIT_ANSWER", value: choice });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Phase 2 handler
  const handleSubmitVote = async (choice: string) => {
    if (!game || !state.context.userId) return;

    try {
      await submitVote({
        gameId: game._id,
        userId: state.context.userId as Id<"users">,
        choice,
      });
      showToast("Vote submitted!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Leave room handler
  const handleLeaveRoom = async () => {
    if (!state.context.userId) return;

    try {
      await leaveRoom({ userId: state.context.userId as Id<"users"> });
      localStorage.removeItem(`ice_user_${roomCode}`);
      router.push("/");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // ============================================================================
  // RENDERING
  // ============================================================================

  // Not joined state - display name entry then avatar selection
  if (state.matches("not_joined")) {
    if (checkingSession) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <LoadingSpinner size="lg" />
          </motion.div>
        </main>
      );
    }

    // Display name entry step
    if (joinStep === "name") {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
          <TitleBar />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="text-center space-y-4">
              <p className="text-xs sm:text-sm font-sans text-muted-foreground uppercase tracking-[0.3em]">
                {roomCode}
              </p>
              <p className="text-xl font-sans text-gray-600 dark:text-gray-300">
                What's your name?
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full px-6 py-4 text-2xl text-center rounded-2xl border-4 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && displayName.trim()) {
                    setJoinStep("avatar");
                  }
                }}
              />

              <button
                onClick={() => setJoinStep("avatar")}
                disabled={!displayName.trim()}
                className={`w-full py-4 rounded-xl text-xl font-bold shadow-lg transition-all ${
                  displayName.trim()
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 active:scale-95"
                    : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                }`}
              >
                Continue
              </button>
            </div>
          </motion.div>
        </main>
      );
    }

    // Avatar selection step
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <TitleBar />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-4">
            <p className="text-xs sm:text-sm font-sans text-muted-foreground uppercase tracking-[0.3em]">
              {roomCode}
            </p>
            <p className="text-xl font-sans text-gray-600 dark:text-gray-300">
              Hi {displayName}! Choose your avatar
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {avatarOptions.map((avatar) => (
              <motion.button
                key={avatar}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setSelectedAvatar(avatar)}
                className={`aspect-square rounded-3xl flex items-center justify-center text-7xl transition-all ${
                  selectedAvatar === avatar
                    ? "bg-primary text-primary-foreground shadow-glow ring-4 ring-primary-300"
                    : "bg-white dark:bg-gray-800 border-4 border-primary-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg"
                }`}
              >
                {avatar}
              </motion.button>
            ))}
          </div>

          {selectedAvatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center"
            >
              <LoadingSpinner size="sm" />
            </motion.div>
          )}

          <button
            onClick={() => setJoinStep("name")}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Back to change name
          </button>
        </motion.div>
      </main>
    );
  }

  // Waiting for round start state
  if (state.matches("waiting_for_round_start")) {
    const userAvatar = state.context.avatar || selectedAvatar;
    const userName = state.context.displayName || displayName;

    // Before game starts
    if (room && !room.phase1Active) {
      return (
        <main className="flex min-h-screen flex-col items-center p-8 bg-background">
          <TitleBar />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="mb-6">
              <AvatarDisplay avatar={userAvatar} size="lg" />
            </div>
            <h2 className="text-3xl font-display font-bold text-gray-900 dark:text-gray-100 mb-4">
              You're in, {userName}!
            </h2>
            <p className="text-xl font-sans text-gray-600 dark:text-gray-300 mb-4">
              Waiting for host to start the game...
            </p>
          </motion.div>
        </main>
      );
    }

    // During game - waiting for group assignment
    return (
      <main className="h-screen flex flex-col bg-background overflow-hidden">
        <TitleBar />

        {room && room.phase1Active && (
          <div className="px-4 pt-4">
            <RoundProgressBar
              currentRound={room.currentRound}
              totalRounds={room.phase1Rounds}
              roundStartedAt={room.roundStartedAt}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-6">
              <AvatarDisplay avatar={userAvatar} size="xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Forming groups...
            </h2>
            <LoadingSpinner size="md" />
          </motion.div>
        </div>
      </main>
    );
  }

  // Name matching state
  if (state.matches("name_matching")) {
    const myUserId = state.context.userId;
    const allMembers = (currentGroup?.members || []).filter((m: any): m is NonNullable<typeof m> => m !== null);
    const otherMembers = allMembers.filter((m) => m.userId !== myUserId) as any[];
    const nameChoices = currentGroup?.nameChoicesByPlayer?.[myUserId!] || {};
    const submittedUsers = (currentGroup?.submittedNameMatching || []).map((id: any) => id.toString());
    const myIncorrectAvatars = myUserId ? (currentGroup?.incorrectByPlayer?.[myUserId] || []) : [];
    const hasSubmitted = myUserId ? (currentGroup?.submittedNameMatching?.includes(myUserId as any) || false) : false;

    return (
      <main className="h-screen flex flex-col bg-background overflow-hidden">
        <TitleBar />

        {room && room.phase1Active && (
          <div className="px-4 pt-4">
            <RoundProgressBar
              currentRound={room.currentRound}
              totalRounds={room.phase1Rounds}
              roundStartedAt={room.roundStartedAt}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <NameMatchingUI
            myAvatar={state.context.avatar}
            myDisplayName={state.context.displayName}
            myUserId={myUserId || ""}
            groupMembers={otherMembers}
            allMembers={allMembers}
            nameChoices={nameChoices}
            onSubmit={handleNameMatchingSubmit}
            submittedUsers={submittedUsers}
            serverIncorrectAvatars={myIncorrectAvatars}
            hasSubmitted={hasSubmitted}
          />
        </div>
      </main>
    );
  }

  // Question active state
  if (state.matches("question_active")) {
    const question = currentGroup?.question;
    const myAnswer = currentGroup?.myAnswer;
    const answers = currentGroup?.answers || {};
    const members = currentGroup?.members || [];

    return (
      <main className="h-screen flex flex-col bg-background overflow-hidden">
        <TitleBar />

        {room && room.phase1Active && (
          <div className="px-4 pt-4">
            <RoundProgressBar
              currentRound={room.currentRound}
              totalRounds={room.phase1Rounds}
              roundStartedAt={room.roundStartedAt}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          {question && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col max-w-lg mx-auto w-full"
            >
              {/* Question text */}
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-8">
                {question.text}
              </h2>

              {/* Options */}
              <div className="space-y-4 flex-1">
                {/* Option A */}
                <button
                  onClick={() => handleSubmitAnswer("A")}
                  disabled={!!myAnswer}
                  className={`w-full p-6 rounded-2xl text-left transition-all ${
                    myAnswer === "A"
                      ? "bg-purple-600 text-white shadow-lg"
                      : myAnswer
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400"
                      : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-purple-400 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">A</span>
                    <span className="text-lg">{question.optionA}</span>
                  </div>
                  {/* Show who picked this */}
                  <div className="flex gap-1 mt-2">
                    {members
                      .filter((m: any) => answers[m.userId] === "A")
                      .map((m: any) => (
                        <span key={m.userId} className="text-xl">
                          {m.avatar}
                        </span>
                      ))}
                  </div>
                </button>

                {/* Option B */}
                <button
                  onClick={() => handleSubmitAnswer("B")}
                  disabled={!!myAnswer}
                  className={`w-full p-6 rounded-2xl text-left transition-all ${
                    myAnswer === "B"
                      ? "bg-blue-600 text-white shadow-lg"
                      : myAnswer
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400"
                      : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">B</span>
                    <span className="text-lg">{question.optionB}</span>
                  </div>
                  {/* Show who picked this */}
                  <div className="flex gap-1 mt-2">
                    {members
                      .filter((m: any) => answers[m.userId] === "B")
                      .map((m: any) => (
                        <span key={m.userId} className="text-xl">
                          {m.avatar}
                        </span>
                      ))}
                  </div>
                </button>
              </div>

              {/* Follow up */}
              {myAnswer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl"
                >
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                    Talk about it:
                  </p>
                  <p className="text-gray-800 dark:text-gray-100 mt-1">
                    {question.followUp}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    );
  }

  // Session locked - waiting for Phase 2
  if (state.matches("session_locked")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <TitleBar />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-6">
            <AvatarDisplay avatar={state.context.avatar} size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Game ended!
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Waiting for slideshow to start...
          </p>
          <LoadingSpinner size="md" />
        </motion.div>
      </main>
    );
  }

  // Phase 2 states
  if (state.matches("phase2_voting") || state.matches("phase2_waiting")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <TitleBar />
        <div className="w-full max-w-md">
          {currentRound && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">
                {currentRound.round.questionText}
              </h2>

              {!hasVoted ? (
                <div className="space-y-4">
                  <button
                    onClick={() => handleSubmitVote("A")}
                    className="w-full p-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors"
                  >
                    A
                  </button>
                  <button
                    onClick={() => handleSubmitVote("B")}
                    className="w-full p-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
                  >
                    B
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-600 dark:text-gray-300 py-8">
                  <p className="text-lg font-medium">Vote submitted!</p>
                  <p className="text-sm mt-2">Waiting for reveal...</p>
                </div>
              )}
            </motion.div>
          )}
          {userScore !== null && userScore !== undefined && (
            <div className="mt-4 text-center text-gray-600 dark:text-gray-300">
              Your score: {typeof userScore === 'object' ? userScore.totalCorrect : userScore}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (state.matches("phase2_complete")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <TitleBar />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-md"
        >
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
            Game Complete!
          </h2>

          {leaderboard && leaderboard.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4">Leaderboard</h3>
              <div className="space-y-3">
                {leaderboard.map((entry: any, index: number) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      entry.userId === state.context.userId
                        ? "bg-purple-100 dark:bg-purple-900"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">#{entry.rank}</span>
                      <span className="text-2xl">{entry.avatar}</span>
                    </div>
                    <span className="font-bold">{entry.totalCorrect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleLeaveRoom}
            className="mt-8 px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Leave Room
          </button>
        </motion.div>
      </main>
    );
  }

  // Fallback
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <LoadingSpinner size="lg" />
    </main>
  );
}

export default function UserPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
          <LoadingSpinner size="lg" />
        </main>
      }
    >
      <UserPageContent />
    </Suspense>
  );
}
