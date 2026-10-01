import React from "react";

export type BadgeIntent = "primary" | "danger" | "success" | "warning" | "info" | "neutral";

export interface BadgeProps {
  intent?: BadgeIntent;
  showDot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ intent = "neutral", showDot = false, className = "", children }: BadgeProps) {
  const intentClasses = {
    primary: "bg-global-primary-soft text-global-primary border-global-primary/20",
    danger: "bg-global-danger-soft text-global-danger-text border-global-danger/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
    success: "bg-global-success-soft text-global-success-text border-global-success/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    warning: "bg-global-warning-soft text-global-warning-text border-global-warning/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    info: "bg-global-info-soft text-global-info-text border-global-info/20",
    neutral: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  const dotClasses = {
    primary: "bg-global-primary",
    danger: "bg-global-danger",
    success: "bg-global-success",
    warning: "bg-global-warning",
    info: "bg-global-info",
    neutral: "bg-gray-400",
  };

  const baseClass = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors shrink-0";

  return (
    <span className={`${baseClass} ${intentClasses[intent]} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[intent]}`} />}
      {children}
    </span>
  );
}
