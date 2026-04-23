"use client";

import React from "react";

export type PulseIconProps = {
  size?: number | string;
  className?: string;
  ariaLabel?: string;
};

export default function PulseIcon({ size = 20, className = "", ariaLabel = "Pulse balance" }: PulseIconProps) {
  const numericSize = typeof size === "number" ? size : parseInt(String(size), 10) || 20;

  return (
    <svg
      width={numericSize}
      height={numericSize}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ filter: "drop-shadow(0 0 8px rgba(255, 0, 127, 0.5))" }}
    >
      <defs>
        <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF007F" />
          <stop offset="100%" stopColor="#9D00FF" />
        </linearGradient>
      </defs>

      {/* Heart shape */}
      <path
        d="M24 39s-11.5-7.7-16-12.1C3.8 22.3 6 14 12.5 12.1 16.2 10.9 20 13.2 24 16c4-2.8 7.8-5.1 11.5-3.9C42 14 44.2 22.3 40 26.9 35.5 31.3 24 39 24 39z"
        fill="url(#pulseGradient)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.5}
      />

      {/* EKG wave overlay */}
      <path
        d="M8 28 L14 22 L18 30 L22 18 L26 30 L30 24 L36 28"
        fill="none"
        stroke="url(#pulseGradient)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
