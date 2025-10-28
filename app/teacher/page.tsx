"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/Toast";

export default function TeacherPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<"auth" | "setup" | "manage">("auth");
  const [className, setClassName] = useState("");
  const [duration, setDuration] = useState(10); // minutes
  const [classId, setClassId] = useState<string | null>(null);
  const [classCode, setClassCode] = useState("");
  const [pin, setPin] = useState("");
  const [enteredPin, setEnteredPin] = useState("");

  const createClass = useMutation(api.classes.createClass);
  const startPhase1 = useMutation(api.classes.startPhase1);
  const stopPhase1 = useMutation(api.classes.stopPhase1);
  const seedQuestions = useMutation(api.questions.seedQuestions);

  const classDoc = useQuery(
    api.classes.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const stats = useQuery(
    api.classes.getClassStats,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const handleCreateClass = async () => {
    if (!className) return;

    try {
      // Seed questions first time
      await seedQuestions();

      const result = await createClass({
        name: className,
        phase1Duration: duration * 60, // convert to seconds
      });

      setClassId(result.classId);
      setClassCode(result.code);
      setPin(result.pin);
      setView("manage");
      showToast("Class created successfully!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleStartPhase1 = async () => {
    if (!classId || !pin) return;

    try {
      await startPhase1({ classId: classId as Id<"classes">, pin });
      showToast("Phase 1 started!", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleStopPhase1 = async () => {
    if (!classId || !pin) return;

    try {
      await stopPhase1({ classId: classId as Id<"classes">, pin });
      showToast("Phase 1 stopped", "info");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleExistingClass = () => {
    if (enteredPin.length === 4) {
      setPin(enteredPin);
      setView("setup");
    }
  };

  // Auth view
  if (view === "auth") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <h1 className="text-4xl font-bold text-center text-gray-900">
            Teacher Dashboard
          </h1>

          <div className="space-y-4">
            <button
              onClick={() => setView("setup")}
              className="w-full px-8 py-6 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
            >
              Create New Class
            </button>

            <div className="text-center text-gray-600">or</div>

            <div className="space-y-3">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full px-6 py-4 text-2xl text-center border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={handleExistingClass}
                disabled={enteredPin.length !== 4}
                className="w-full px-8 py-4 text-lg font-semibold text-green-700 border-2 border-green-600 rounded-xl hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition"
              >
                Access Existing Class
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  // Setup view
  if (view === "setup") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <h1 className="text-4xl font-bold text-center text-gray-900">
            Create Class
          </h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class Name
              </label>
              <input
                type="text"
                placeholder="e.g., English 101"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase 1 Duration (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={30}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleCreateClass}
              disabled={!className}
              className="w-full px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Create Class
            </button>

            <button
              onClick={() => setView("auth")}
              className="w-full px-8 py-3 text-lg text-gray-600 hover:text-gray-900 transition"
            >
              Back
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  // Manage view
  if (view === "manage" && classDoc) {
    const timeElapsed = classDoc.phase1StartedAt
      ? Math.floor((Date.now() - classDoc.phase1StartedAt) / 1000)
      : 0;
    const timeRemaining = Math.max(0, classDoc.phase1Duration - timeElapsed);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-8"
        >
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {classDoc.name}
            </h1>
            <div className="text-sm text-gray-600">PIN: {pin}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-green-600 mb-2">
                {classCode}
              </div>
              <p className="text-gray-600">Class Code</p>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">Status:</span>
                <span
                  className={`px-4 py-2 rounded-full font-semibold ${
                    classDoc.phase1Active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {classDoc.phase1Active ? "Active" : "Not Started"}
                </span>
              </div>

              {classDoc.phase1Active && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">
                    {minutes}:{seconds.toString().padStart(2, "0")}
                  </div>
                  <p className="text-gray-600">Time Remaining</p>
                </div>
              )}

              {stats && (
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {stats.totalStudents}
                    </div>
                    <p className="text-sm text-gray-600">Students</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {stats.activePairs}
                    </div>
                    <p className="text-sm text-gray-600">Active Pairs</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {stats.completedPairs}
                    </div>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              {!classDoc.phase1Active ? (
                <button
                  onClick={handleStartPhase1}
                  className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
                >
                  Start Phase 1
                </button>
              ) : (
                <button
                  onClick={handleStopPhase1}
                  className="flex-1 px-8 py-4 text-xl font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition"
                >
                  Stop Phase 1
                </button>
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-gray-600">
              Share the 4-digit class code with students
            </p>
            <p className="text-sm text-gray-500">
              Students enter the code at the home page
            </p>
          </div>
        </motion.div>
      </main>
    );
  }

  return null;
}
