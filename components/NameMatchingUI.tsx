"use client";

import { useState, useEffect } from "react";

type NameMatchingUIProps = {
  myAvatar: string;
  myDisplayName: string;
  myUserId: string;
  groupMembers: Array<{
    userId: any;
    displayName: string;
    avatar: string;
    code: number;
  }>;
  allMembers: Array<{
    userId: any;
    displayName: string;
    avatar: string;
    code: number;
  }>;
  nameChoices: Record<string, string[]>; // userId -> [name1, name2, name3]
  onSubmit: (selections: Record<string, string>) => Promise<any>;
  submittedUsers: string[]; // userIds who have submitted
  serverIncorrectAvatars: string[]; // From server after all submit
  hasSubmitted: boolean;
};

export function NameMatchingUI({
  myAvatar,
  myDisplayName,
  myUserId,
  groupMembers,
  allMembers,
  nameChoices,
  onSubmit,
  submittedUsers,
  serverIncorrectAvatars,
  hasSubmitted,
}: NameMatchingUIProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use server's incorrect avatars for highlighting
  const incorrectAvatars = new Set(serverIncorrectAvatars);

  // Reset selections for incorrect avatars when server returns errors
  useEffect(() => {
    if (serverIncorrectAvatars.length > 0) {
      setSelections((prev) => {
        const next = { ...prev };
        serverIncorrectAvatars.forEach((avatarId) => {
          delete next[avatarId];
        });
        return next;
      });
    }
  }, [serverIncorrectAvatars]);

  // Filter out self from group members
  const otherMembers = groupMembers;

  // Check if all selections are made
  const allSelected = otherMembers.every((member) => selections[member.userId]);

  const handleSelectName = (userId: string, name: string) => {
    setSelections((prev) => ({
      ...prev,
      [userId]: name,
    }));
  };

  const handleSubmit = async () => {
    if (!allSelected || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selections);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show waiting state after submitting
  if (hasSubmitted && serverIncorrectAvatars.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Waiting for others...
        </h2>
        {/* Show all members with submission status */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {allMembers.map((member) => {
            const hasFinished = submittedUsers.includes(member.userId);
            const isMe = member.userId === myUserId;
            return (
              <div
                key={member.userId}
                className={`flex flex-col items-center p-3 rounded-xl ${
                  hasFinished
                    ? "ring-4 ring-gray-400 dark:ring-gray-500"
                    : "opacity-50"
                }`}
              >
                <div className="text-5xl mb-1">{member.avatar}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {isMe ? "You" : member.displayName}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6 flex flex-col">
      {/* My Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="text-8xl mb-3">{myAvatar}</div>
        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {myDisplayName}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          That's you!
        </div>
      </div>

      {/* Error message only when there are incorrect avatars */}
      {serverIncorrectAvatars.length > 0 && (
        <div className="text-center text-red-600 dark:text-red-400 mb-6 font-medium">
          Some names were wrong - fix the red ones and resubmit
        </div>
      )}

      {/* Other Members Grid */}
      <div className="flex-1 flex flex-col gap-4 mb-6">
        {otherMembers.map((member) => {
          const choices = nameChoices[member.userId] || [];
          const isIncorrect = incorrectAvatars.has(member.userId);

          return (
            <div
              key={member.userId}
              className={`bg-white dark:bg-gray-700 rounded-xl p-4 shadow-md transition-all ${
                isIncorrect
                  ? "border-2 border-red-500 animate-pulse"
                  : "border-2 border-transparent"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="text-5xl">{member.avatar}</div>
                </div>

                {/* Dropdown */}
                <div className="flex-1">
                  <select
                    value={selections[member.userId] || ""}
                    onChange={(e) => handleSelectName(member.userId, e.target.value)}
                    className={`w-full px-4 py-3 text-lg rounded-lg border-2 ${
                      isIncorrect
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : selections[member.userId]
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-300 dark:border-gray-500"
                    } bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors`}
                  >
                    <option value="">Select name...</option>
                    {choices.map((name, index) => (
                      <option key={index} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {isIncorrect && (
                    <div className="text-red-600 dark:text-red-400 text-sm mt-1 font-medium">
                      Wrong - try again
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!allSelected || isSubmitting}
        className={`w-full py-4 rounded-xl text-xl font-bold shadow-lg transition-all ${
          allSelected && !isSubmitting
            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 active:scale-95"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        }`}
      >
        {isSubmitting ? "Submitting..." : serverIncorrectAvatars.length > 0 ? "Resubmit" : "Submit"}
      </button>
    </div>
  );
}
