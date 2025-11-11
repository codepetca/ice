"use client";

import {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
  forwardRef,
} from "react";
import { cn } from "@/lib/theme";

type ScreenPadding = "none" | "compact" | "default" | "relaxed";

const paddingPresets: Record<ScreenPadding, { x: string; y: string }> = {
  none: { x: "0px", y: "0px" },
  compact: {
    x: "clamp(1rem, 4vw, 1.5rem)",
    y: "clamp(1rem, 4vh, 1.5rem)",
  },
  default: {
    x: "clamp(1.25rem, 4vw, 2rem)",
    y: "clamp(1.25rem, 4vh, 2rem)",
  },
  relaxed: {
    x: "clamp(1.5rem, 5vw, 3rem)",
    y: "clamp(1.5rem, 5vh, 3rem)",
  },
};

type ScreenProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  padding?: ScreenPadding;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function Screen<T extends ElementType = "div">({
  as,
  children,
  className,
  innerClassName,
  padding = "default",
  style,
  ...rest
}: ScreenProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const preset = paddingPresets[padding];
  const safeAreaStyle = {
    paddingTop: `max(env(safe-area-inset-top), ${preset.y})`,
    paddingBottom: `max(env(safe-area-inset-bottom), ${preset.y})`,
    paddingLeft: `max(env(safe-area-inset-left), ${preset.x})`,
    paddingRight: `max(env(safe-area-inset-right), ${preset.x})`,
  } as const;

  return (
    <Component
      className={cn("min-h-dvh w-full bg-background text-foreground", className)}
      style={{ ...safeAreaStyle, ...style }}
      {...rest}
    >
      <div className={cn("flex h-full w-full flex-col", innerClassName)}>
        {children}
      </div>
    </Component>
  );
}

type PageContainerSize = "sm" | "md" | "lg" | "xl" | "full";
type PageContainerAlign = "top" | "center";

const sizeClasses: Record<PageContainerSize, string> = {
  sm: "max-w-md",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-none",
};

const alignClasses: Record<PageContainerAlign, string> = {
  top: "items-start justify-center",
  center: "items-center justify-center",
};

type PageContainerProps = {
  children: ReactNode;
  size?: PageContainerSize;
  align?: PageContainerAlign;
  className?: string;
  bleed?: boolean;
};

export function PageContainer({
  children,
  size = "md",
  align = "top",
  className,
  bleed = false,
}: PageContainerProps) {
  return (
    <div className={cn("flex w-full flex-1", alignClasses[align])}>
      <div
        className={cn(
          "w-full",
          sizeClasses[size],
          bleed ? "" : "space-y-8",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

type SurfaceProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  as?: ElementType;
  padded?: boolean;
  children: ReactNode;
};

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  { as, padded = true, className, children, ...rest },
  ref
) {
  const Component = (as ?? "section") as ElementType;
  return (
    <Component
      ref={ref as any}
      className={cn(
        "rounded-3xl border border-border/60 bg-card/95 shadow-lg shadow-black/5 backdrop-blur-sm",
        padded && "p-4 sm:p-6 lg:p-8",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
});
