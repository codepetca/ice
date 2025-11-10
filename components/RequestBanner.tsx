"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

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
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  // Show only the most recent request
  const request = requests[0];

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onAccept(requestId);
      // Keep processing state until request disappears from list on success
    } catch (error) {
      setProcessingId(null);
      throw error;
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onReject(requestId);
      // Keep processing state until request disappears from list on success
    } catch (error) {
      setProcessingId(null);
      throw error;
    }
  };

  const isProcessing = processingId === request.requestId;

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
          <div className="bg-card rounded-lg shadow-lg border-2 border-primary p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-2">{request.requester.avatar}</div>
              <div className="text-xl font-display font-bold mt-2">
                wants to join your group!
              </div>
            </div>

            {isProcessing ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="flex gap-3 mt-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleReject(request.requestId)}
                  disabled={isProcessing}
                  className="flex-1 bg-muted hover:bg-muted/80 font-bold py-3 px-4 rounded-lg text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <X size={20} />
                  Decline
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAccept(request.requestId)}
                  disabled={isProcessing}
                  className="flex-1 bg-success text-white hover:opacity-90 font-bold py-3 px-4 rounded-lg text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  <Check size={20} />
                  Accept
                </motion.button>
              </div>
            )}

            {requests.length > 1 && (
              <div className="text-center mt-4 text-sm font-sans text-muted-foreground">
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
          <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-3 flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-3xl">{request.requester.avatar}</div>
              <div className="flex-1">
                <div className="font-semibold font-sans">
                  wants to join
                </div>
                {requests.length > 1 && (
                  <div className="text-xs opacity-90 font-sans">
                    +{requests.length - 1} more waiting
                  </div>
                )}
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center">
                <LoadingSpinner size="sm" color="border-white/40 border-t-white" />
              </div>
            ) : (
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleReject(request.requestId)}
                  disabled={isProcessing}
                  className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <X size={16} />
                  No
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAccept(request.requestId)}
                  disabled={isProcessing}
                  className="bg-white text-primary font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <Check size={16} />
                  Accept
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
}
