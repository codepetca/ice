"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToastTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { id, message, type };

    // Replace any existing toast with the new one
    setToast(newToast);
    clearToastTimeout();

    // Auto-dismiss after 4 seconds
    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
      timeoutRef.current = null;
    }, 4000);
  };

  const removeToast = () => {
    clearToastTimeout();
    setToast(null);
  };

  useEffect(() => {
    return () => {
      clearToastTimeout();
    };
  }, []);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-success text-white shadow-lg";
      case "error":
        return "bg-red-500 text-white shadow-lg";
      case "warning":
        return "bg-warning text-white shadow-lg";
      case "info":
        return "bg-primary text-primary-foreground shadow-lg";
      default:
        return "bg-card border-2 border-border text-card-foreground shadow-lg";
    }
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`${getToastStyles(
                toast.type
              )} px-6 py-4 rounded-lg flex items-center gap-4 min-w-[320px] max-w-md pointer-events-auto`}
              onClick={removeToast}
            >
              <span className="text-3xl">{getToastIcon(toast.type)}</span>
              <p className="flex-1 text-base font-sans font-semibold">{toast.message}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast();
                }}
                className="text-white/80 hover:text-white text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
