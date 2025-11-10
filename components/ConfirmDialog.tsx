"use client";

import { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmDialogContextType = {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<
  ConfirmDialogContextType | undefined
>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return context;
}

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ options, resolve });
    });
  };

  const handleConfirm = () => {
    if (dialog) {
      dialog.resolve(true);
      setDialog(null);
    }
  };

  const handleCancel = () => {
    if (dialog) {
      dialog.resolve(false);
      setDialog(null);
    }
  };

  return (
    <ConfirmDialogContext.Provider value={{ showConfirm }}>
      {children}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {dialog && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={handleCancel}
            />

            {/* Dialog */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-card text-card-foreground rounded-lg shadow-lg max-w-md w-full p-6 space-y-4 pointer-events-auto border border-border"
              >
                <h3 className="text-2xl font-display font-bold">
                  {dialog.options.title}
                </h3>
                <p className="text-base font-sans text-muted-foreground">
                  {dialog.options.message}
                </p>
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2.5 text-base font-semibold bg-muted rounded-lg hover:bg-muted/80 transition-all"
                  >
                    {dialog.options.cancelText || "Cancel"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2.5 text-base font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm transition-all"
                  >
                    {dialog.options.confirmText || "Confirm"}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </ConfirmDialogContext.Provider>
  );
}
