"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Sun, Moon } from "lucide-react";

interface TitleBarProps {
  title?: string;
  subtitle?: string;
  showTitle?: boolean;
}

export function TitleBar({ title, subtitle, showTitle = false }: TitleBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Initialize dark mode
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored === "dark" || (!stored && prefersDark);
    setIsDark(shouldBeDark);

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setSettingsOpen(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Left side - Title (optional) */}
        <div className="flex-1">
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
