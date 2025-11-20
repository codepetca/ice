import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "We'll be back soon - Ice",
  description: "Ice is temporarily unavailable",
};

export default function ClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <Image
            src="/icewyrm.png"
            alt="Ice"
            width={200}
            height={200}
            priority
            className="w-32 h-32 sm:w-40 sm:h-40 opacity-50"
          />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground">
            We&apos;ll be back soon
          </h1>
          
          <p className="text-base sm:text-lg text-muted-foreground">
            This app is temporarily unavailable while we prepare for the next event.
          </p>
        </div>
      </div>
    </div>
  );
}
