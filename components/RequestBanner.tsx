"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

interface IncomingRequest {
  requestId: string;
  requester: {
    id: string;
    avatar: string;
    code: number;
  };
  createdAt: number;
  expiresAt: number;
}

interface RequestBannerProps {
  requests: IncomingRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  intrusive?: boolean; // If true, shows as modal; if false, shows as subtle banner
}

export function RequestBanner({
  requests,
  onAccept,
  onReject,
  intrusive = true,
}: RequestBannerProps) {
  if (requests.length === 0) return null;

  // Show only the most recent request
  const request = requests[0];

  if (intrusive) {
    // Full screen modal style for waiting/browsing phase
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-x-0 top-0 z-50 flex items-start justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-4 border-blue-500 p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-2">{request.requester.avatar}</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                wants to join your group!
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => onReject(request.requestId)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 px-6 rounded-xl text-xl transition-colors flex items-center justify-center gap-2"
              >
                <X size={24} />
                Decline
              </button>
              <button
                onClick={() => onAccept(request.requestId)}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-xl transition-colors flex items-center justify-center gap-2"
              >
                <Check size={24} />
                Accept
              </button>
            </div>

            {requests.length > 1 && (
              <div className="text-center mt-4 text-sm text-gray-500">
                +{requests.length - 1} more waiting
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  } else {
    // Subtle banner at top for active session
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed inset-x-0 top-0 z-50 p-2"
        >
          <div className="bg-blue-500 text-white rounded-xl shadow-lg p-3 flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-3xl">{request.requester.avatar}</div>
              <div className="flex-1">
                <div className="font-semibold">
                  wants to join
                </div>
                {requests.length > 1 && (
                  <div className="text-xs opacity-90">
                    +{requests.length - 1} more waiting
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onReject(request.requestId)}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-1"
              >
                <X size={16} />
                No
              </button>
              <button
                onClick={() => onAccept(request.requestId)}
                className="bg-white text-blue-500 hover:bg-blue-50 font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-1"
              >
                <Check size={16} />
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
}
