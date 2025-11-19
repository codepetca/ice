"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Screen } from "@/components/layout/Page";

export default function ClosedPage() {
  return (
    <Screen as="main" padding="compact" innerClassName="justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center space-y-8"
      >
        <div className="flex justify-center">
          <Image
            src="/icewyrm.png"
            alt="Icewyrm"
            width={200}
            height={200}
            priority
            className="w-32 h-32 sm:w-48 sm:h-48 opacity-50 grayscale"
          />
        </div>

        <div className="text-center space-y-4">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            Icewyrm is currently closed
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            We&apos;ll be available again soon.
          </p>
        </div>
      </motion.div>
    </Screen>
  );
}
