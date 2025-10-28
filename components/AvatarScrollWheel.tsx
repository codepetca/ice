"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { getEmojiName } from "@/lib/avatars";

interface Student {
  id: string;
  avatar: string;
  code: number;
}

interface AvatarScrollWheelProps {
  students: Student[];
  onSelect: (studentId: string) => void;
}

export function AvatarScrollWheel({ students, onSelect }: AvatarScrollWheelProps) {
  // Sort students alphabetically by emoji name
  const sortedStudents = [...students].sort((a, b) => {
    const nameA = getEmojiName(a.avatar);
    const nameB = getEmojiName(b.avatar);
    return nameA.localeCompare(nameB);
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to center the selected item
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const itemHeight = 100; // Height of each item
      const scrollPosition = selectedIndex * itemHeight - container.clientHeight / 2 + itemHeight / 2;
      container.scrollTo({ top: scrollPosition, behavior: "smooth" });
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const itemHeight = 100;
    const scrollTop = container.scrollTop;
    const centerOffset = container.clientHeight / 2;
    const index = Math.round((scrollTop + centerOffset - itemHeight / 2) / itemHeight);

    const clampedIndex = Math.max(0, Math.min(index, sortedStudents.length - 1));
    setSelectedIndex(clampedIndex);
  };

  const handleSelect = () => {
    if (sortedStudents[selectedIndex]) {
      onSelect(sortedStudents[selectedIndex].id);
    }
  };

  if (sortedStudents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No other students in the class yet...</p>
        <p className="text-sm mt-2">Waiting for others to join</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scroll Wheel Container */}
      <div className="relative w-full h-80 overflow-hidden rounded-2xl bg-gradient-to-b from-purple-50 via-white to-purple-50">
        {/* Center highlight bar */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-24 bg-purple-100 border-y-4 border-purple-400 pointer-events-none z-10" />

        {/* Scrollable list */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll scrollbar-hide py-28"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {/* Top padding for centering first item */}
          <div className="h-28" />

          {sortedStudents.map((student, index) => {
            const isSelected = index === selectedIndex;
            const name = getEmojiName(student.avatar);

            return (
              <div
                key={student.id}
                className="h-24 flex items-center justify-center"
                style={{ scrollSnapAlign: "center" }}
              >
                <div
                  className={`flex items-center gap-4 transition-all duration-200 ${
                    isSelected ? "scale-110" : "scale-90 opacity-50"
                  }`}
                >
                  <span className={isSelected ? "text-7xl" : "text-5xl"}>
                    {student.avatar}
                  </span>
                  <div className="text-left">
                    <div className={`font-bold capitalize ${isSelected ? "text-2xl text-purple-700" : "text-lg text-gray-600"}`}>
                      {name}
                    </div>
                    <div className={`font-mono ${isSelected ? "text-xl text-gray-600" : "text-sm text-gray-400"}`}>
                      {student.code}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom padding for centering last item */}
          <div className="h-28" />
        </div>

        {/* Fade effect at top and bottom */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-purple-50 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-purple-50 to-transparent pointer-events-none" />
      </div>

      {/* Select Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleSelect}
        className="w-full px-8 py-4 text-2xl font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition shadow-lg"
      >
        Select {sortedStudents[selectedIndex] ? getEmojiName(sortedStudents[selectedIndex].avatar) : ""}
      </motion.button>
    </div>
  );
}
