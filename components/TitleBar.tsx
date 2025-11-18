"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Sun, Moon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useDarkMode } from "@/lib/useDarkMode";

interface TitleBarProps {
  title?: string;
  subtitle?: string;
  showTitle?: boolean;
}

export function TitleBar({ title, subtitle, showTitle = false }: TitleBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isDark, toggleDarkMode: toggleDarkModeBase } = useDarkMode();

  // Wrapper to close settings menu when toggling dark mode
  const toggleDarkMode = () => {
    toggleDarkModeBase();
    setSettingsOpen(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Left side - Logo and Title (optional) */}
        <div className="flex-1 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <Image
              src="/icewyrm.png"
              alt="Ice"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </Link>
          {showTitle && title && (
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Right side - Settings Button */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-2 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-foreground" />
          </button>

          {/* Settings Dropdown */}
          <AnimatePresence>
            {settingsOpen && (
              <>
                {/* Backdrop */}
                <div
                  onClick={() => setSettingsOpen(false)}
                  className="fixed inset-0 z-40"
                />

                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-12 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                >
                  <button
                    onClick={toggleDarkMode}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-5 h-5 flex items-center justify-center text-foreground">
                      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {isDark ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
