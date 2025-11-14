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
import { RequestBanner } from "@/components/RequestBanner";
import { getRandomAvatars } from "@/lib/avatars";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SlideshowQuestion } from "@/components/SlideshowQuestion";
import { TitleBar } from "@/components/TitleBar";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { WaitingScreen } from "@/components/WaitingScreen";

function UserPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [state, send] = useMachine(userMachine);
  const [roomCode] = useState(searchParams.get("roomCode") || "");
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const prevOutgoingRequestRef = useRef<any>(undefined);
  const hasCheckedSessionRef = useRef(false);

  const joinRoom = useMutation(api.users.joinRoom);
  const rejoinRoom = useMutation(api.users.rejoinRoom);
  const sendGroupRequest = useMutation(api.groups.sendGroupRequest);
  const acceptGroupRequest = useMutation(api.groups.acceptGroupRequest);
  const rejectGroupRequest = useMutation(api.groups.rejectGroupRequest);
  const cancelGroupRequest = useMutation(api.groups.cancelGroupRequest);
  const submitAnswer = useMutation(api.groups.submitAnswer);
  const completeGroup = useMutation(api.groups.completeGroup);

  // Phase 2 mutations
  const submitVote = useMutation(api.games.submitVote);
  const leaveRoom = useMutation(api.users.leaveRoom);

  const validateUserSession = useQuery(
    api.users.validateUserSession,
    state.context.userId && roomCode
      ? { userId: state.context.userId as Id<"users">, roomCode }
      : "skip"
  );

  const availableUsers = useQuery(
    api.groups.getAvailableUsers,
    state.context.userId && state.context.roomId
      ? {
          roomId: state.context.roomId as Id<"rooms">,
          excludeUserId: state.context.userId as Id<"users">,
        }
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

  const incomingRequests = useQuery(
    api.groups.getIncomingRequests,
    state.context.userId ? { userId: state.context.userId as Id<"users"> } : "skip"
  );

  const outgoingRequest = useQuery(
    api.groups.getOutgoingRequest,
    state.context.userId ? { userId: state.context.userId as Id<"users"> } : "skip"
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

      // Prevent duplicate checks in React Strict Mode
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
        const { userId, avatar, code: userCode, roomId } = sessionData;

        const result = await rejoinRoom({ userId, roomCode });

        send({
          type: "JOIN_ROOM",
          userId: result.userId,
          roomId: result.roomId,
          code: result.code,
          avatar: result.avatar,
        });

        showToast("Welcome back!", "success");
      } catch (error: any) {
        localStorage.removeItem(`ice_user_${roomCode}`);
        // Session expired or invalid - user will need to rejoin
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
      (state.matches("browsing") || state.matches("question_active"))
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
  }, [game, currentRound, state, send]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Auto-transition to waiting after voting
  useEffect(() => {
    if (
      state.matches("phase2_voting") &&
      hasVoted === true
    ) {
      send({ type: "SUBMIT_VOTE", choice: "dummy" }); // Choice already submitted via mutation
    }
  }, [hasVoted, state, send]);

  // Phase 2: Monitor round advancement
  useEffect(() => {
    if (
      state.matches("phase2_waiting") &&
      gameState?.game
    ) {
      // Check if we moved to a new round
      const currentInState = state.context.currentRoundNumber;
      const currentInGame = gameState.game.currentRound;

      if (currentInGame > currentInState!) {
        // New round started
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
  }, [game, state, send]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Monitor room reset (when admin resets room)
  useEffect(() => {
    if (
      room &&
      !room.phase1StartedAt &&
      (state.matches("phase2_reveal") ||
       state.matches("phase2_waiting") ||
       state.matches("phase2_voting") ||
       state.matches("phase2_complete"))
    ) {
      // Room was reset - transition back to browsing
      send({ type: "ROOM_RESET" });
      showToast("Room reset", "info");
    }
  }, [room?.phase1StartedAt, state, send]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor group status - detect when group is created/joined or completed
  useEffect(() => {
    // If we're in a group state but currentGroup is null, group was completed
    if (!currentGroup && state.context.userId) {
      if (state.matches("question_active")) {
        setElapsedTime(0);
        setSelectedUser(null);
        send({ type: "LEAVE_GROUP" });
        showToast("Join another group!", "info");

        // Show confetti for all participants
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
      return;
    }

    if (!currentGroup) return;

    // If we're browsing and we have a group, transition to group
    if (state.matches("browsing") && currentGroup.groupId) {
      send({
        type: "JOINED_GROUP",
        groupId: currentGroup.groupId,
        members: currentGroup.members,
        question: currentGroup.question,
      });
    }

    // If waiting for acceptance and we have a group, transition to group
    if (state.matches("waiting_for_acceptance") && currentGroup.groupId) {
      send({
        type: "JOINED_GROUP",
        groupId: currentGroup.groupId,
        members: currentGroup.members,
        question: currentGroup.question,
      });
    }
  }, [currentGroup, state, send]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for group session
  useEffect(() => {
    if (!state.matches("question_active") || !currentGroup?.createdAt) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - currentGroup.createdAt) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [state, currentGroup?.createdAt]);

  // Auto-cancel waiting for acceptance after 30 seconds
  useEffect(() => {
    if (!state.matches("waiting_for_acceptance")) {
      return;
    }

    const timeout = setTimeout(() => {
      handleCancelRequest();
      // Don't show toast here - the monitoring effect will show "Request expired"
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor outgoing request and auto-cancel if rejected/expired
  useEffect(() => {
    if (!state.matches("waiting_for_acceptance")) {
      prevOutgoingRequestRef.current = undefined;
      return;
    }

    // Check if request status changed from pending to something else
    const prevStatus = prevOutgoingRequestRef.current?.status;
    const currentStatus = outgoingRequest?.status;

    if (prevStatus === "pending" && currentStatus && currentStatus !== "pending") {
      // Don't show message if we're actually joining a group
      if (!currentGroup?.groupId) {
        send({ type: "CANCEL_REQUEST" });
        setSelectedUser(null);

        // Show specific message based on status
        if (currentStatus === "rejected") {
          showToast("Request was declined", "info");
        } else if (currentStatus === "expired") {
          showToast("Request expired", "info");
        } else if (currentStatus === "cancelled") {
          showToast("Request was cancelled", "info");
        }
      }
    }

    // Also check if request disappeared entirely
    const hadRequest = prevOutgoingRequestRef.current !== undefined && prevOutgoingRequestRef.current !== null;
    const requestGone = outgoingRequest === null;

    if (hadRequest && requestGone && prevStatus === "pending") {
      // Don't show message if we're actually joining a group
      if (!currentGroup?.groupId) {
        send({ type: "CANCEL_REQUEST" });
        setSelectedUser(null);
        showToast("Request expired", "info");
      }
    }

    // Update ref for next comparison
    prevOutgoingRequestRef.current = outgoingRequest;
  }, [outgoingRequest, state, send, currentGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinRoom = async () => {
    if (!roomCode || !selectedAvatar) return;

    try {
      const result = await joinRoom({ roomCode, avatar: selectedAvatar });
      send({
        type: "JOIN_ROOM",
        userId: result.userId,
        roomId: result.roomId,
        code: result.code,
        avatar: selectedAvatar,
      });

      localStorage.setItem(
        `ice_user_${roomCode}`,
        JSON.stringify({
          userId: result.userId,
          avatar: selectedAvatar,
          code: result.code,
          roomId: result.roomId,
          lastJoined: Date.now(),
        })
      );
    } catch (error: any) {
      // Show error and redirect back to home if room doesn't exist
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
    if (selectedAvatar && !state.context.userId) {
      handleJoinRoom();
    }
  }, [selectedAvatar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendRequest = async (targetId: string) => {
    if (!state.context.userId) return;

    try {
      const result = await sendGroupRequest({
        userId: state.context.userId as Id<"users">,
        targetId: targetId as Id<"users">,
      });

      if (result.success) {
        if ("createdGroup" in result || "joinedGroup" in result) {
          // Automatically joined/created group
          send({
            type: "JOINED_GROUP",
            groupId: (result as any).groupId!,
            members: (result as any).members || [],
            question: (result as any).question,
          });
        } else {
          // Request sent, waiting for acceptance
          send({ type: "SEND_REQUEST", targetId });
        }
      }
    } catch (error: any) {
      // Show rate limit errors as info instead of error
      if (error.message === "Please wait...") {
        showToast(error.message, "info");
      } else {
        showToast(error.message, "error");
      }
      setSelectedUser(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!state.context.userId) return;

    try {
      await cancelGroupRequest({ userId: state.context.userId as Id<"users"> });
      send({ type: "CANCEL_REQUEST" });
      setSelectedUser(null);
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!state.context.userId) return;

    const wasAlreadyInGroup = !!currentGroup?.groupId;

    try {
      const result = await acceptGroupRequest({
        userId: state.context.userId as Id<"users">,
        requestId: requestId as Id<"groupRequests">,
      });

      if (result.success) {
        // Only send JOINED_GROUP event if we weren't already in a group
        if (!wasAlreadyInGroup) {
          send({
            type: "JOINED_GROUP",
            groupId: (result as any).groupId!,
            members: (result as any).members || [],
            question: (result as any).question,
          });
        }
      }
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!state.context.userId) return;

    try {
      await rejectGroupRequest({
        userId: state.context.userId as Id<"users">,
        requestId: requestId as Id<"groupRequests">,
      });
      showToast("Request declined", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleSubmitAnswer = async (choice: string) => {
    if (!choice || !state.context.groupId || !state.context.userId) return;

    try {
      await submitAnswer({
        userId: state.context.userId as Id<"users">,
        groupId: state.context.groupId as Id<"groups">,
        choice,
      });
      send({ type: "SUBMIT_ANSWER", value: choice });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleLeaveGroup = async () => {
    if (!state.context.userId || !state.context.groupId) return;

    await completeGroup({
      userId: state.context.userId as Id<"users">,
      groupId: state.context.groupId as Id<"groups">,
    });

    // Note: confetti and state updates now happen in the useEffect that monitors group completion
    // This ensures all participants see the confetti, not just the user who clicked "Done"
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
      // Clear local storage
      localStorage.removeItem(`ice_user_${roomCode}`);
      // Navigate to landing page
      router.push("/");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Not joined state
  if (state.matches("not_joined")) {
    if (checkingSession) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <LoadingSpinner size="lg" />
          </motion.div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <TitleBar />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="flex justify-center gap-3">
              {roomCode.split('').map((letter, index) => (
                <div
                  key={index}
                  className="w-16 h-20 flex items-center justify-center text-4xl font-display font-bold border-4 border-primary-300 rounded-3xl bg-primary text-primary-foreground shadow-glow uppercase text-white"
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-xl font-sans text-gray-600">Choose your avatar</p>
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
        </motion.div>
      </main>
    );
  }

  // Browsing state
  if (state.matches("browsing")) {
    if (room && !room.phase1Active) {
      const userAvatar = state.context.avatar || selectedAvatar;

      return (
        <main className="flex min-h-screen flex-col items-center p-8 bg-background">
          <TitleBar />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8 text-center mt-8"
          >
            <div className="mb-6">
              <AvatarDisplay avatar={userAvatar} size="lg" />
            </div>
            <h2 className="text-3xl font-display font-bold text-gray-900 mb-4">
              You&apos;re in!
            </h2>
            <p className="text-xl font-sans text-gray-600 mb-4">
              Waiting for host to start the session...
            </p>
          </motion.div>
        </main>
      );
    }

    const userAvatar = state.context.avatar || selectedAvatar;

    return (
      <main className="flex min-h-screen flex-col items-center p-8 bg-background">
        <TitleBar />
        {/* Incoming requests banner */}
        {incomingRequests && incomingRequests.length > 0 && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={true}
          />
        )}

        {/* Winding down warning banner */}
        {room?.windingDownStartedAt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 top-0 z-40 p-2"
          >
            <div className="bg-orange-500 text-white rounded-xl shadow-lg p-4 text-center max-w-md mx-auto">
              <div className="font-bold text-lg">⏰ Session ending soon!</div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 text-center mt-8"
        >
          <div className="mb-6">
            <AvatarDisplay avatar={userAvatar} size="xl" />
          </div>

          <div className="space-y-6">
            {availableUsers && availableUsers.length > 0 ? (
              <>
                <h3 className="text-2xl font-semibold text-gray-700">
                  Join up
                </h3>
                {!room?.windingDownStartedAt && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {availableUsers.map((user) => {
                        const hasIncomingRequests = incomingRequests && incomingRequests.length > 0;
                        const isDisabled = hasIncomingRequests;

                        return (
                          <motion.button
                            key={user.id}
                            whileTap={isDisabled ? {} : { scale: 0.95 }}
                            onClick={() => {
                              if (isDisabled) return;
                              setSelectedUser(user.id);
                              handleSendRequest(user.id);
                            }}
                            disabled={isDisabled}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-6xl transition-all relative ${
                              isDisabled
                                ? "bg-gray-100 dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed"
                                : selectedUser === user.id
                                ? "bg-primary text-primary-foreground shadow-xl ring-4 ring-primary-300"
                                : "bg-white dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-lg"
                            }`}
                          >
                            {selectedUser === user.id ? (
                              <LoadingSpinner size="md" color="border-purple-200 border-t-white" />
                            ) : (
                              <>
                                <div>{user.avatar}</div>
                                 {user.groupSize > 0 && (
                                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                    {user.groupSize}/{room?.maxGroupSize || 4}
                                  </div>
                                )}
                              </>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg font-medium">
                  Waiting for others to be available
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    );
  }

  // Waiting for acceptance state
  if (state.matches("waiting_for_acceptance")) {
    // Show incoming requests even while waiting
    const inRequestsDisplay = incomingRequests && incomingRequests.length > 0;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <TitleBar />
        {inRequestsDisplay && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={false}
          />
        )}

        <WaitingScreen
          title={outgoingRequest ? "Waiting for response from..." : "Waiting for response..."}
        >
          {outgoingRequest && (
            <AvatarDisplay
              avatar={outgoingRequest.target.avatar}
              size="xl"
              withHalo={true}
            />
          )}

          <button
            onClick={handleCancelRequest}
            className="w-full max-w-xs px-6 py-4 text-base sm:text-lg font-semibold text-foreground border-2 border-border rounded-xl hover:bg-muted transition"
          >
            Cancel Request
          </button>
        </WaitingScreen>
      </main>
    );
  }

  // Question active state
  if (state.matches("question_active")) {
    const question = currentGroup?.question || state.context.question;
    const members = currentGroup?.members || state.context.groupMembers;
    const myAnswer = state.context.myAnswer;

    const membersChosenA = members.filter((m: any) => m.answer === "A");
    const membersChosenB = members.filter((m: any) => m.answer === "B");

    const canComplete = elapsedTime >= 60;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-3 sm:p-8 bg-gradient-to-b from-yellow-50 to-white">
        <TitleBar />
        {/* Show subtle banner for incoming requests during active session */}
        {incomingRequests && incomingRequests.length > 0 && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={false}
          />
        )}

        {/* Winding down warning banner */}
        {room?.windingDownStartedAt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 top-0 z-40 p-2"
          >
            <div className="bg-orange-500 text-white rounded-xl shadow-lg p-4 text-center max-w-md mx-auto">
              <div className="font-bold text-lg">⏰ Session ending soon!</div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-3 sm:space-y-8"
        >
          <div className="text-center">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-8 leading-tight">
              {question?.text}
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmitAnswer("A")}
                className={`rounded-3xl flex flex-row items-stretch p-5 sm:p-7 text-2xl font-bold text-white bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 shadow-xl transition min-h-[180px] sm:min-h-0 sm:aspect-square ${
                  myAnswer === "A" ? "ring-4 ring-primary-300" : ""
                }`}
              >
                {/* A label on left - narrow column */}
                <div className="flex items-center justify-center pr-2 sm:pr-3">
                  <div className="text-4xl sm:text-5xl font-bold">A</div>
                </div>
                
                {/* Right side: 2 rows - text top, avatars bottom */}
                <div className="flex-1 flex flex-col justify-between">
                  {/* Text row - centered in cell */}
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center leading-tight text-lg sm:text-2xl font-semibold">
                      {question?.optionA}
                    </div>
                  </div>
                  
                  {/* Avatar row - centered in cell, fixed height to prevent layout shift */}
                  <div className="min-h-[56px] sm:min-h-[70px] flex gap-1 flex-wrap justify-center items-center">
                    {membersChosenA.length > 0 ? (
                      membersChosenA.map((member: any) => (
                        <div key={member.id} className="text-4xl sm:text-6xl">
                          {member.avatar}
                        </div>
                      ))
                    ) : (
                      // Invisible placeholder to maintain space
                      <div className="h-[48px] sm:h-[64px]" aria-hidden="true"></div>
                    )}
                  </div>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmitAnswer("B")}
                className={`rounded-3xl flex flex-row items-stretch p-5 sm:p-7 text-2xl font-bold text-white bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-xl transition min-h-[180px] sm:min-h-0 sm:aspect-square ${
                  myAnswer === "B" ? "ring-4 ring-blue-300" : ""
                }`}
              >
                {/* B label on left - narrow column */}
                <div className="flex items-center justify-center pr-2 sm:pr-3">
                  <div className="text-4xl sm:text-5xl font-bold">B</div>
                </div>
                
                {/* Right side: 2 rows - text top, avatars bottom */}
                <div className="flex-1 flex flex-col justify-between">
                  {/* Text row - centered in cell */}
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center leading-tight text-lg sm:text-2xl font-semibold">
                      {question?.optionB}
                    </div>
                  </div>
                  
                  {/* Avatar row - centered in cell, fixed height to prevent layout shift */}
                  <div className="min-h-[56px] sm:min-h-[70px] flex gap-1 flex-wrap justify-center items-center">
                    {membersChosenB.length > 0 ? (
                      membersChosenB.map((member: any) => (
                        <div key={member.id} className="text-4xl sm:text-6xl">
                          {member.avatar}
                        </div>
                      ))
                    ) : (
                      // Invisible placeholder to maintain space
                      <div className="h-[48px] sm:h-[64px]" aria-hidden="true"></div>
                    )}
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Progress button or warning */}
            <div className="w-full">
              {room?.windingDownStartedAt ? (
                // Winding down - show warning instead of progress
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-full h-12 sm:h-16 rounded-xl overflow-hidden ring-4 ring-orange-400 shadow-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500" />
                  <div className="relative z-10 flex items-center justify-center h-full">
                    <p className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg">
                      ⏰ Session ending soon!
                    </p>
                  </div>
                </motion.div>
              ) : (
                // Normal progress button
                <motion.button
                  whileTap={canComplete ? { scale: 0.95 } : {}}
                  whileHover={canComplete ? { scale: 1.02 } : {}}
                  onClick={handleLeaveGroup}
                  disabled={!canComplete}
                  animate={canComplete ? {
                    boxShadow: [
                      "0 10px 40px rgba(59, 130, 246, 0.5)",
                      "0 10px 60px rgba(34, 197, 94, 0.6)",
                      "0 10px 40px rgba(59, 130, 246, 0.5)"
                    ]
                  } : {}}
                  transition={canComplete ? {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : {}}
                  className={`relative w-full h-12 sm:h-16 rounded-xl overflow-hidden transition-all ${
                    canComplete
                      ? "ring-4 ring-green-400 cursor-pointer shadow-2xl"
                      : "shadow-lg cursor-not-allowed"
                  }`}
                >
                  {/* Background fill */}
                  <motion.div
                    className={`absolute inset-0 ${
                      canComplete
                        ? "bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 bg-[length:200%_100%]"
                        : "bg-gradient-to-r from-blue-500 to-green-500"
                    }`}
                    initial={{ width: "0%" }}
                    animate={
                      canComplete
                        ? {
                            width: "100%",
                            backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"]
                          }
                        : { width: `${Math.min((elapsedTime / 60) * 100, 100)}%` }
                    }
                    transition={
                      canComplete
                        ? {
                            width: { duration: 0.5 },
                            backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" }
                          }
                        : { duration: 0.5 }
                    }
                  />
                  {/* Gray background for unfilled portion */}
                  <div className="absolute inset-0 bg-gray-300 -z-10" />

                  {/* Button text */}
                  <motion.div
                    className="relative z-10 flex items-center justify-center h-full"
                    animate={canComplete ? { scale: [1, 1.05, 1] } : {}}
                    transition={canComplete ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                  >
                    <p className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg">
                      {canComplete ? "Done" : "Choose and discuss"}
                    </p>
                  </motion.div>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  // Wrap up state - DISABLED: "wrap_up" state doesn't exist in userStateMachine
  // This code is unreachable and has been commented out
  /*
  if (state.matches("wrap_up")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <TitleBar />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="text-8xl">✨</div>
          <h2 className="text-4xl font-bold text-gray-900">
            Great conversation!
          </h2>
          <button
            onClick={() => {
              setSelectedUser(null);
              send({ type: "LEAVE_GROUP" });
            }}
            className="px-12 py-4 text-2xl font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition shadow-xl"
          >
            Find Another Group
          </button>
        </motion.div>
      </main>
    );
  }
  */

  // Session locked state
  if (state.matches("session_locked")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <TitleBar />
        <WaitingScreen title="Results Starting..." />
      </main>
    );
  }

  // Phase 2: Slideshow viewing (replaces voting, waiting, and reveal)
  if (state.matches("phase2_voting") || state.matches("phase2_waiting") || state.matches("phase2_reveal")) {
    const questionText = state.context.gameQuestion || currentRound?.questionData?.text || currentRound?.round.questionText || "";
    const roundNumber = state.context.currentRoundNumber || currentRound?.round.roundNumber;
    const totalRounds = gameState?.game?.totalRounds || 0;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 pb-20 bg-background overflow-hidden">
        <TitleBar />
        <AnimatePresence mode="wait">
          <motion.div
            key={roundNumber}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0.0, 0.2, 1]
            }}
            className="w-full max-w-2xl space-y-6"
          >
            {currentRound?.questionData && (
              <SlideshowQuestion
                questionText={questionText}
                optionA={currentRound.questionData.optionA}
                optionB={currentRound.questionData.optionB}
                percentA={currentRound.questionData.percentA}
                percentB={currentRound.questionData.percentB}
                totalResponses={currentRound.questionData.totalResponses}
                isRevealed={!!currentRound?.round.revealedAt}
                roundNumber={roundNumber || 1}
                variant="user"
              />
            )}

          </motion.div>
        </AnimatePresence>

        {/* Leave button - fixed at bottom */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleLeaveRoom}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 text-lg font-semibold text-foreground bg-background border-2 border-border rounded-xl hover:bg-muted transition-colors shadow-lg"
          aria-label="Leave room"
        >
          Leave
        </motion.button>
      </main>
    );
  }

  // Phase 2: Complete state - just show session ended
  if (state.matches("phase2_complete")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 pb-20 bg-gradient-to-b from-gray-50 to-white">
        <TitleBar />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="text-8xl">🔒</div>
          <h2 className="text-4xl font-bold text-gray-900">
            Session Ended
          </h2>
          <p className="text-xl text-gray-600">
            Thanks for participating!
          </p>
        </motion.div>

        {/* Leave button - fixed at bottom */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleLeaveRoom}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 text-lg font-semibold text-foreground bg-background border-2 border-border rounded-xl hover:bg-muted transition-colors shadow-lg"
          aria-label="Leave room"
        >
          Leave
        </motion.button>
      </main>
    );
  }

  return null;
}

export default function UserPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <LoadingSpinner size="lg" />
      </main>
    }>
      <UserPageContent />
    </Suspense>
  );
}
