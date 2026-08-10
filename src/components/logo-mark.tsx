"use client";

import { useState } from "react";

/**
 * Traces a golf swing arc from backswing through impact to follow-through,
 * with the ball travelling along it. Plays once on mount; hovering the
 * wrapping span replays it. Reduced-motion users get the resting frame only.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const [playKey, setPlayKey] = useState(0);

  return (
    <span
      className="logo-mark-wrap"
      onMouseEnter={() => setPlayKey((k) => k + 1)}
    >
      <svg
        key={playKey}
        viewBox="0 0 40 40"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="arc"
          d="M5 13 C 9 24, 13 30, 16 31 C 21 29, 30 17, 35 6"
          fill="none"
          strokeLinecap="round"
          strokeWidth="2.75"
          pathLength={1}
        />
        <g className="burst" strokeLinecap="round" strokeWidth="1.4">
          <line x1="16" y1="31" x2="13.1" y2="33.3" />
          <line x1="16" y1="31" x2="19.5" y2="32.7" />
          <line x1="16" y1="31" x2="16" y2="34.8" />
        </g>
        <circle className="ball" cx="35" cy="6" r="3.1" strokeWidth="0.8" />
      </svg>
      <style jsx>{`
        .logo-mark-wrap {
          display: inline-flex;
          line-height: 0;
        }
        .arc {
          stroke: var(--fairway);
          stroke-dasharray: 1;
          stroke-dashoffset: 0;
          animation: logo-arc-draw 0.85s cubic-bezier(0.22, 0.68, 0.32, 1) both;
        }
        .ball {
          fill: var(--sand);
          stroke: var(--fog);
          transform-box: fill-box;
          transform-origin: 50% 50%;
          animation:
            logo-ball-move 0.85s cubic-bezier(0.22, 0.68, 0.32, 1) both,
            logo-ball-land 0.85s cubic-bezier(0.22, 0.68, 0.32, 1) both;
        }
        .burst {
          stroke: var(--sand);
          opacity: 0;
          transform-box: fill-box;
          transform-origin: 16px 31px;
          animation: logo-burst-flash 0.85s cubic-bezier(0.22, 0.68, 0.32, 1) both;
        }
        @keyframes logo-arc-draw {
          from {
            stroke-dashoffset: 1;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes logo-ball-move {
          0% {
            cx: 5px;
            cy: 13px;
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          25% {
            cx: 10.9px;
            cy: 25.75px;
          }
          45% {
            cx: 16px;
            cy: 31px;
          }
          72% {
            cx: 25.5px;
            cy: 21.9px;
          }
          100% {
            cx: 35px;
            cy: 6px;
            opacity: 1;
          }
        }
        @keyframes logo-ball-land {
          0%,
          88% {
            transform: scale(1);
          }
          93% {
            transform: scale(1.4);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes logo-burst-flash {
          0%,
          42% {
            opacity: 0;
            transform: scale(0.5);
          }
          47% {
            opacity: 1;
            transform: scale(1);
          }
          60%,
          100% {
            opacity: 0;
            transform: scale(1.25);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .arc,
          .ball,
          .burst {
            animation: none;
          }
          .burst {
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}
