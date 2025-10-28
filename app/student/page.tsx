"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMachine } from "@xstate/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { studentMachine } from "@/lib/studentStateMachine";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";
import { Keypad } from "@/components/Keypad";
import { AvatarScrollWheel } from "@/components/AvatarScrollWheel";
import { getRandomAvatars } from "@/lib/avatars";

export default function StudentPage() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [state, send] = useMachine(studentMachine);
  const [classCode] = useState(searchParams.get("classCode") || "");
  const [avatarOptions] = useState(getRandomAvatars(3));
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [answerValue, setAnswerValue] = useState("");

  const joinClass = useMutation(api.students.joinClass);
  const sendPairRequestById = useMutation(api.pairing.sendPairRequestById);
  const acceptPairRequest = useMutation(api.pairing.acceptPairRequest);
  const declinePairRequest = useMutation(api.pairing.declinePairRequest);
  const submitAnswer = useMutation(api.pairing.submitAnswer);
  const completePair = useMutation(api.pairing.completePair);
  const cancelPairRequest = useMutation(api.pairing.cancelPairRequest);

  const activeStudents = useQuery(
    api.students.getActiveStudents,
    state.context.studentId && state.context.classId
      ? {
          classId: state.context.classId as Id<"classes">,
          excludeStudentId: state.context.studentId as Id<"students">,
        }
      : "skip"
  );

  const currentPair = useQuery(
    api.pairing.getCurrentPair,
    state.context.studentId ? { studentId: state.context.studentId as Id<"students"> } : "skip"
  );

  const classDoc = useQuery(
    api.classes.getClassById,
    state.context.classId ? { classId: state.context.classId as Id<"classes"> } : "skip"
  );

  const pendingRequest = useQuery(
    api.pairing.getPendingRequest,
    state.context.studentId ? { studentId: state.context.studentId as Id<"students"> } : "skip"
  );

  // Check if class session is locked (Phase 1 was active but is now stopped)
  useEffect(() => {
    if (
      classDoc &&
      !classDoc.phase1Active &&
      classDoc.phase1StartedAt && // Only lock if Phase 1 was previously started
      state.matches("waiting_for_partner")
    ) {
      send({ type: "SESSION_LOCKED" });
    }
  }, [classDoc, state, send]);

  // Monitor pair status - detect when pair is created while waiting
  useEffect(() => {
    if (!currentPair || !state.context.studentId) return;

    // Partner A waiting, then Partner B completes the pairing
    if (state.matches("waiting_for_partner") && currentPair.pairId && currentPair.partner && currentPair.question) {
      send({
        type: "PAIRED",
        pairId: currentPair.pairId,
        partnerName: currentPair.partner.avatar,
        question: currentPair.question,
      });
    }

    // Both answered transition
    if (state.matches("question_active") && currentPair.bothAnswered) {
      send({ type: "BOTH_ANSWERED" });
    }
  }, [currentPair, state, send]);

  // Auto-trigger partner code pairing when 2 digits entered
  useEffect(() => {
    if (partnerCodeInput.length === 2 && !state.context.partnerCode) {
      handleEnterPartnerCode();
    }
  }, [partnerCodeInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinClass = async () => {
    if (!classCode || !selectedAvatar) return;

    try {
      const result = await joinClass({ classCode, avatar: selectedAvatar });
      send({
        type: "JOIN_CLASS",
        studentId: result.studentId,
        classId: result.classId,
        code: result.code,
        name: selectedAvatar, // Store avatar as name in state machine
      });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  // Auto-join when avatar is selected
  useEffect(() => {
    if (selectedAvatar && !state.context.studentId) {
      handleJoinClass();
    }
  }, [selectedAvatar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPartner = async (partnerId: string) => {
    if (!state.context.studentId) return;

    try {
      await sendPairRequestById({
        studentId: state.context.studentId as Id<"students">,
        partnerId: partnerId as Id<"students">,
      });
      showToast("Request sent! Waiting for them to accept...", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    if (!state.context.studentId) return;

    try {
      const result = await acceptPairRequest({
        studentId: state.context.studentId as Id<"students">,
        requesterId: requesterId as Id<"students">,
      });

      if (result.paired && result.pairId && result.partner) {
        send({
          type: "PAIRED",
          pairId: result.pairId,
          partnerName: result.partner.avatar,
          question: result.question,
        });
      }
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleDeclineRequest = async (requesterId: string) => {
    if (!state.context.studentId) return;

    try {
      await declinePairRequest({
        studentId: state.context.studentId as Id<"students">,
        requesterId: requesterId as Id<"students">,
      });
      showToast("Request declined", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleEnterPartnerCode = async () => {
    if (!partnerCodeInput || !state.context.studentId) return;

    const code = parseInt(partnerCodeInput);
    if (isNaN(code) || code < 10 || code > 99) {
      showToast("Please enter a valid 2-digit code", "warning");
      return;
    }

    try {
      send({ type: "ENTER_PARTNER_CODE", code });
      const result = await requestPair({
        studentId: state.context.studentId as Id<"students">,
        partnerCode: code,
      });

      if (result.paired && result.pairId && result.partner) {
        send({
          type: "PAIRED",
          pairId: result.pairId,
          partnerName: result.partner.avatar,
          question: result.question,
        });
      }
    } catch (error: any) {
      showToast(error.message, "error");
      setPartnerCodeInput("");
    }
  };

  const handleCancelRequest = async () => {
    if (!state.context.studentId) return;
    await cancelPairRequest({ studentId: state.context.studentId as Id<"students"> });
    setPartnerCodeInput("");
    send({ type: "CANCEL_REQUEST" });
  };

  const handleSubmitAnswer = async () => {
    if (!answerValue || !state.context.pairId || !state.context.studentId) return;

    const value = parseFloat(answerValue);
    if (isNaN(value)) {
      showToast("Please enter a valid number", "warning");
      return;
    }

    try {
      await submitAnswer({
        studentId: state.context.studentId as Id<"students">,
        pairId: state.context.pairId as Id<"pairs">,
        value,
      });
      send({ type: "SUBMIT_ANSWER", value });
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleTalkingComplete = () => {
    send({ type: "TALKING_COMPLETE" });
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleMeetSomeoneNew = async () => {
    if (!state.context.studentId || !state.context.pairId) return;

    await completePair({
      studentId: state.context.studentId as Id<"students">,
      pairId: state.context.pairId as Id<"pairs">,
    });

    setPartnerCodeInput("");
    setAnswerValue("");
    send({ type: "MEET_SOMEONE_NEW" });
  };

  // Not joined state
  if (state.matches("not_joined")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Choose your avatar
            </h1>
            <p className="text-gray-600">Class code: {classCode}</p>
          </div>

          {/* Avatar Selection Grid */}
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

  // Waiting for partner state
  if (state.matches("waiting_for_partner")) {
    // Show waiting screen if class hasn't started yet
    if (classDoc && !classDoc.phase1Active) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="text-6xl mb-6">⏳</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              You're in!
            </h2>
            <p className="text-xl text-gray-600 mb-4">
              Waiting for teacher to start the session...
            </p>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 mt-8">
              <p className="text-sm text-gray-600 mb-2">Your code</p>
              <div className="text-5xl font-bold text-purple-600">
                {state.context.studentCode}
              </div>
            </div>
          </motion.div>
        </main>
      );
    }

    // Show normal pairing screen once class is active
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              Your Code
            </h2>
            <div className="text-9xl font-bold text-purple-600">
              {state.context.studentCode}
            </div>
          </div>

          {/* Show incoming pair request */}
          {pendingRequest ? (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 space-y-6"
            >
              <div className="space-y-2">
                <p className="text-lg text-gray-600">Someone wants to pair!</p>
                <div className="text-8xl">{pendingRequest.requester.avatar}</div>
                <p className="text-2xl font-bold text-gray-800">
                  Code: {pendingRequest.requester.code}
                </p>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDeclineRequest(pendingRequest.requester.id)}
                  className="flex-1 px-6 py-4 text-xl font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition"
                >
                  Decline
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAcceptRequest(pendingRequest.requester.id)}
                  className="flex-1 px-6 py-4 text-xl font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 transition"
                >
                  Accept
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-700">
                Choose your partner
              </h3>

              {/* Avatar Scroll Wheel */}
              <AvatarScrollWheel
                students={activeStudents || []}
                onSelect={handleSelectPartner}
              />
            </div>
          )}
        </motion.div>
      </main>
    );
  }

  // Paired intro state
  if (state.matches("paired_intro")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            You're paired with
          </h2>
          <div className="text-9xl mb-4">
            {currentPair?.partner?.avatar || state.context.partnerName}
          </div>
          <div className="text-3xl font-semibold text-green-600">
            Code: {currentPair?.partner?.code}
          </div>
        </motion.div>
      </main>
    );
  }

  // Question active state
  if (state.matches("question_active")) {
    const question = currentPair?.question || state.context.question;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-yellow-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-8"
        >
          <div className="text-center">
            <div className="text-6xl mb-6">❓</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {question?.text}
            </h2>
          </div>

          {!currentPair?.myAnswered ? (
            <div className="space-y-6">
              {/* Answer Display */}
              <div className="w-full px-6 py-6 text-4xl text-center font-bold border-4 border-yellow-300 rounded-2xl bg-white min-h-[80px] flex items-center justify-center">
                {answerValue || "___"}
              </div>
              {question?.unit && (
                <p className="text-center text-xl text-gray-600">
                  {question.unit}
                </p>
              )}

              {/* Keypad */}
              <Keypad
                value={answerValue}
                onChange={setAnswerValue}
                maxLength={10}
                allowDecimal={true}
              />

              {/* Submit Button */}
              <button
                onClick={handleSubmitAnswer}
                disabled={!answerValue}
                className="w-full px-8 py-4 text-2xl font-semibold text-white bg-yellow-600 rounded-xl hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Submit
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="text-6xl">⏳</div>
              <p className="text-2xl font-semibold text-gray-700">
                Waiting for your partner...
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>
    );
  }

  // Talking phase state
  if (state.matches("talking_phase")) {
    const question = currentPair?.question || state.context.question;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-2xl space-y-8 text-center"
        >
          <div className="text-6xl mb-6">💬</div>
          <h2 className="text-3xl font-semibold mb-4">
            Share your answers!
          </h2>
          <p className="text-2xl text-gray-300">
            {question?.followUp}
          </p>

          <div className="mt-12">
            <button
              onClick={handleTalkingComplete}
              className="px-12 py-4 text-xl font-semibold text-gray-900 bg-white rounded-xl hover:bg-gray-100 transition"
            >
              Done Talking
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  // Wrap up state
  if (state.matches("wrap_up")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-pink-50 to-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center space-y-8"
        >
          <div className="text-8xl">✨</div>
          <h2 className="text-4xl font-bold text-gray-900">
            Great conversation!
          </h2>
          <button
            onClick={handleMeetSomeoneNew}
            className="px-12 py-4 text-2xl font-semibold text-white bg-pink-600 rounded-xl hover:bg-pink-700 transition"
          >
            Meet Someone New
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
