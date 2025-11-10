interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

export function LoadingSpinner({ size = "md", color }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-4",
    lg: "w-12 h-12 border-4",
  };

  const colorClasses = color || "border-muted border-t-primary";

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses} rounded-full animate-spin`}
    />
  );
}
