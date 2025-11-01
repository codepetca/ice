"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useMachine } from "@xstate/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { userMachine } from "@/lib/userStateMachine";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { RequestBanner } from "@/components/RequestBanner";
import { getRandomAvatars, getEmojiName } from "@/lib/avatars";

export default function UserPage() {
  const searchParams = useSearchParams();
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
        console.log("Session expired or invalid:", error.message);
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
      state.matches("browsing")
    ) {
      send({ type: "SESSION_LOCKED" });
    }
  }, [room, state, send]);

  // Monitor group status - detect when group is created/joined or completed
  useEffect(() => {
    // If we're in a group state but currentGroup is null, group was completed
    if (!currentGroup && state.context.userId) {
      if (state.matches("question_active")) {
        setElapsedTime(0);
        setSelectedUser(null);
        send({ type: "LEAVE_GROUP" });
        showToast("Session completed", "info");
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
      showToast("Joined group!", "success");
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
      showToast(error.message, "error");
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
          showToast("Joined group!", "success");
        } else {
          // Request sent, waiting for acceptance
          send({ type: "SEND_REQUEST", targetId });
          showToast("Request sent!", "info");
        }
      }
    } catch (error: any) {
      showToast(error.message, "error");
      setSelectedUser(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!state.context.userId) return;

    try {
      await cancelGroupRequest({ userId: state.context.userId as Id<"users"> });
      send({ type: "CANCEL_REQUEST" });
      setSelectedUser(null);
      showToast("Request cancelled", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!state.context.userId) return;

    try {
      const result = await acceptGroupRequest({
        userId: state.context.userId as Id<"users">,
        requestId: requestId as Id<"groupRequests">,
      });

      if (result.success) {
        send({
          type: "JOINED_GROUP",
          groupId: (result as any).groupId!,
          members: (result as any).members || [],
          question: (result as any).question,
        });
        showToast("Joined group!", "success");
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

    setElapsedTime(0);
    setSelectedUser(null);
    send({ type: "LEAVE_GROUP" });

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Not joined state
  if (state.matches("not_joined")) {
    if (checkingSession) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-6"
          >
            <div className="text-6xl">🔄</div>
            <p className="text-xl text-gray-600">Checking session...</p>
          </motion.div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
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
                  className="w-16 h-20 flex items-center justify-center text-4xl font-bold border-4 border-blue-300 rounded-2xl bg-blue-600 shadow-lg uppercase text-white"
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-xl text-gray-600">Choose your avatar</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {avatarOptions.map((avatar) => (
              <motion.button
                key={avatar}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedAvatar(avatar)}
                className={`aspect-square rounded-3xl flex items-center justify-center text-7xl transition-all ${
                  selectedAvatar === avatar
                    ? "bg-blue-500 shadow-xl ring-4 ring-blue-300"
                    : "bg-white border-4 border-gray-200 hover:border-blue-300 hover:shadow-lg"
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
              className="text-center"
            >
              <p className="text-gray-600">Joining as {selectedAvatar}...</p>
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
      const userAvatarName = userAvatar ? getEmojiName(userAvatar) : "";

      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="text-6xl mb-6">⏳</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              You&apos;re in!
            </h2>
            <p className="text-xl text-gray-600 mb-4">
              Waiting for host to start the session...
            </p>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 mt-8">
              <div className="text-7xl mb-4">{userAvatar}</div>
              <p className="text-2xl font-bold text-purple-600 capitalize">
                {userAvatarName}
              </p>
            </div>
          </motion.div>
        </main>
      );
    }

    const userAvatar = state.context.avatar || selectedAvatar;
    const userAvatarName = userAvatar ? getEmojiName(userAvatar) : "";

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white">
        {/* Incoming requests banner */}
        {incomingRequests && incomingRequests.length > 0 && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={true}
          />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 capitalize">
              {userAvatarName}
            </h2>
            <div className="text-9xl mb-6">{userAvatar}</div>
          </div>

          <div className="space-y-6">
            {availableUsers && availableUsers.length > 0 ? (
              <>
                <h3 className="text-2xl font-semibold text-gray-700">
                  Join a group
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {[...availableUsers]
                    .sort((a, b) => {
                      const nameA = getEmojiName(a.avatar);
                      const nameB = getEmojiName(b.avatar);
                      return nameA.localeCompare(nameB);
                    })
                    .map((user) => {
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
                          className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-6xl transition-all ${
                            isDisabled
                              ? "bg-gray-100 border-4 border-gray-200 opacity-40 cursor-not-allowed"
                              : selectedUser === user.id
                              ? "bg-purple-500 shadow-xl ring-4 ring-purple-300"
                              : "bg-white border-4 border-gray-200 hover:border-purple-300 hover:shadow-lg"
                          }`}
                        >
                          <div>{user.avatar}</div>
                          {user.groupSize > 0 && (
                            <div className="text-xs mt-1 text-gray-600">
                              {user.groupSize}/{room?.maxGroupSize || 4}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                </div>
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
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white">
        {inRequestsDisplay && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={false}
          />
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center"
        >
          {outgoingRequest && (
            <>
              <p className="text-2xl font-bold text-gray-900 mb-4">
                Waiting for response from...
              </p>
              <div className="text-9xl mb-4">{outgoingRequest.target.avatar}</div>
            </>
          )}
          {!outgoingRequest && (
            <>
              <p className="text-xl font-semibold text-gray-700">
                Waiting for response...
              </p>
            </>
          )}
          <button
            onClick={handleCancelRequest}
            className="w-full px-6 py-4 text-lg font-semibold text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel Request
          </button>
        </motion.div>
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
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-yellow-50 to-white">
        {/* Show subtle banner for incoming requests during active session */}
        {incomingRequests && incomingRequests.length > 0 && (
          <RequestBanner
            requests={incomingRequests}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            intrusive={false}
          />
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-8"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {question?.text}
            </h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmitAnswer("A")}
                className={`aspect-square rounded-3xl flex flex-col items-center justify-center p-6 text-2xl font-bold text-white bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 shadow-xl transition ${
                  myAnswer === "A" ? "ring-4 ring-purple-300" : ""
                }`}
              >
                <div className="text-4xl mb-3">A</div>
                <div className="text-center leading-tight mb-3">
                  {question?.optionA}
                </div>
                {membersChosenA.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap justify-center">
                    {membersChosenA.map((member: any) => (
                      <div key={member.id} className="text-3xl">
                        {member.avatar}
                      </div>
                    ))}
                  </div>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmitAnswer("B")}
                className={`aspect-square rounded-3xl flex flex-col items-center justify-center p-6 text-2xl font-bold text-white bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-xl transition ${
                  myAnswer === "B" ? "ring-4 ring-blue-300" : ""
                }`}
              >
                <div className="text-4xl mb-3">B</div>
                <div className="text-center leading-tight mb-3">
                  {question?.optionB}
                </div>
                {membersChosenB.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap justify-center">
                    {membersChosenB.map((member: any) => (
                      <div key={member.id} className="text-3xl">
                        {member.avatar}
                      </div>
                    ))}
                  </div>
                )}
              </motion.button>
            </div>

            {/* Progress button */}
            <div className="w-full">
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
                className={`relative w-full h-16 rounded-xl overflow-hidden transition-all ${
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
                  <p className="text-2xl font-bold text-white drop-shadow-lg">
                    {canComplete ? "Done" : "Choose and discuss"}
                  </p>
                </motion.div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  // Wrap up state
  if (state.matches("wrap_up")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
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

  // Session locked state
  if (state.matches("session_locked")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-white">
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
      </main>
    );
  }

  return null;
}
