/**
 * The Grip Intelligence crest: a hexagonal shield, two broken rings, and a
 * golfer at address.
 *
 * `animate` runs the swing sequence — club back, through impact, ball away
 * down its arc, and a burst at the apex. The rings are split into two groups
 * that rotate on different curves so the mark reads as a swing rather than a
 * spinning logo. Everything is driven by CSS keyframes in globals.css, so it
 * costs no JavaScript and stops dead under prefers-reduced-motion.
 *
 * The defaults reproduce the looping 4.2s hero crest. The intro sequences in
 * components/intro drive the same mark differently:
 *   `draw`     — ink the shield and rings on instead of showing them outright
 *   `loop`     — off for a single swing that settles rather than repeating
 *   `duration` — scales the whole timeline, so impact stays at 36% of it
 *   `delay`    — holds address while the draw finishes
 *
 * Every strike lands at the same fraction of `duration`, which is what lets a
 * caller sync a screen wipe to impact without hardcoding frame numbers.
 */
export function LogoMark({
  size = 28,
  animate = false,
  loop = true,
  duration = 4.2,
  delay = 0,
  draw = false,
  drawDelay = 0,
}: {
  size?: number;
  animate?: boolean;
  /** Repeat the swing forever. Off leaves the mark settled after one. */
  loop?: boolean;
  /** Full swing timeline in seconds. Impact is at 36%, the burst at 58%. */
  duration?: number;
  /** Milliseconds held at address before the swing starts. */
  delay?: number;
  /** Ink the stroked parts on rather than having them present at frame one. */
  draw?: boolean;
  drawDelay?: number;
}) {
  const count = loop ? "infinite" : "1 both";
  const run = (name: string, curve: string) =>
    animate ? `${name} ${duration}s ${curve} ${delay}ms ${count}` : undefined;

  /**
   * Dash-draw for a stroked path. `pathLength` renormalises the geometry to 1
   * so the dash values are the same for the shield and for a short arc — no
   * per-path length measuring, and it survives an edit to the `d`.
   */
  const ink = (offset: number, ms: number) =>
    draw
      ? {
          pathLength: 1,
          strokeDasharray: 1,
          style: {
            strokeDashoffset: 1,
            animation: `gi-crest-draw ${ms}ms cubic-bezier(.22,1,.36,1) ${drawDelay + offset}ms both`,
          },
        }
      : {};

  /** Solid shapes cannot be drawn, so they arrive as the last stroke lands. */
  const fadeIn = draw
    ? `gi-fade 460ms cubic-bezier(.22,1,.36,1) ${drawDelay + 760}ms both`
    : undefined;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className="block shrink-0 overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      {/* Shield */}
      <path
        d="M86.6 18.7 Q100 10 113.4 18.7 L156.3 46.3 Q169.7 55 169.7 71 L169.7 129 Q169.7 145 156.3 153.7 L113.4 181.3 Q100 190 86.6 181.3 L43.7 153.7 Q30.3 145 30.3 129 L30.3 71 Q30.3 55 43.7 46.3 Z"
        fill="none"
        stroke="var(--green)"
        strokeWidth="9"
        {...ink(0, 1040)}
      />

      {/* Outer rings — carry the ball's arc when animating. */}
      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "100px 102px",
          animation: run("gi-ring-ball", "cubic-bezier(.12,.72,.24,1)"),
        }}
      >
        <path
          d="M39.35 89.1 A62 62 0 0 1 129.1 47.3"
          fill="none"
          stroke="var(--green)"
          strokeWidth="5.5"
          strokeLinecap="round"
          {...ink(300, 720)}
        />
        <path
          d="M161.8 96.6 A62 62 0 0 1 129.1 156.7"
          fill="none"
          stroke="var(--green)"
          strokeWidth="5.5"
          strokeLinecap="round"
          {...ink(380, 720)}
        />
        {animate ? (
          <path
            d="M138.2 53.1 A62 62 0 0 1 160.6 89.1"
            fill="none"
            stroke="var(--none)"
            strokeWidth="5.5"
            strokeLinecap="round"
            {...ink(460, 720)}
          />
        ) : null}
      </g>

      {/* Inner ring — tracks the club. */}
      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "100px 102px",
          animation: run("gi-ring-club", "cubic-bezier(.5,0,.35,1)"),
        }}
      >
        <path
          d="M47.2 90.8 A54 54 0 0 0 51.1 124.8"
          fill="none"
          stroke="var(--green)"
          strokeWidth="6.5"
          strokeLinecap="round"
          {...ink(520, 640)}
        />
      </g>

      {/* Ground */}
      <path
        d="M46.9 134 A62 62 0 0 0 153.1 134 Q100 139 46.9 134 Z"
        fill="var(--green)"
        style={{ animation: fadeIn }}
      />

      {animate ? (
        <>
          {/* Teed ball, struck at 36% of the timeline. */}
          <circle
            cx="143"
            cy="140"
            r="2.4"
            fill="var(--surface)"
            style={{ animation: run("gi-tee", "steps(1,end)") }}
          />
          <circle
            cx="90"
            cy="146"
            r="1.7"
            fill="var(--surface)"
            opacity=".7"
            style={{ animation: fadeIn }}
          />
          <path
            d="M143 140 C156 112 168 74 176 26"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="300"
            opacity="0"
            style={{ animation: run("gi-trail", "ease-out") }}
          />
          <circle
            r="3"
            fill="var(--surface)"
            style={{
              offsetPath: "path('M143 140 C156 112 168 74 176 26')",
              animation: run("gi-ballfly", "cubic-bezier(.18,.62,.3,1)"),
            }}
          />
          {/* Burst at the apex. */}
          <g>
            <circle
              cx="176"
              cy="26"
              r="7"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="1.2"
              opacity="0"
              style={{
                transformBox: "view-box",
                transformOrigin: "176px 26px",
                animation: run("gi-flash", "ease-out"),
              }}
            />
            <g
              opacity="0"
              stroke="var(--green)"
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{
                transformBox: "view-box",
                transformOrigin: "176px 26px",
                animation: run("gi-spark", "cubic-bezier(.16,.8,.3,1)"),
              }}
            >
              <path d="M176 14 L176 5" />
              <path d="M184 17 L191 10" />
              <path d="M188 26 L198 26" />
              <path d="M184 35 L191 42" />
              <path d="M176 38 L176 47" />
              <path d="M168 35 L161 42" />
              <path d="M164 26 L154 26" />
              <path d="M168 17 L161 10" />
            </g>
          </g>
        </>
      ) : null}

      {/* Golfer — body stays put; only the arms and club swing. */}
      <g fill="var(--ink)" style={{ animation: fadeIn }}>
        <circle cx="103" cy="60" r="6.3" />
        <path d="M95.5 69.5 L112 66 L109.5 84 L107.5 96.5 L98.5 96.5 L96.5 82 Z" />
        <path d="M96 93 L106 93 L102 120 L101 138 L92.5 138 L94.5 118 Z" />
        <path d="M91 134 L102 134 L102 141 L88 141 Z" />
        <path d="M104 93 L113 95 L117.5 120 L121 132 L112.5 135 L109 119 Z" />
        <path d="M111.5 130 L120.5 127.5 L123.5 134 L113.5 137 Z" />
      </g>

      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "103px 94px",
          // Two animations on one element: the fade owns opacity, the swing
          // owns transform, so they compose instead of overwriting.
          animation: [fadeIn, run("gi-swing", "cubic-bezier(.5,0,.35,1)")]
            .filter(Boolean)
            .join(", "),
        }}
      >
        <path d="M105 79.6 L112.3 82.8 L120.3 64.5 L112.9 61.3 Z" fill="var(--ink)" />
        <path d="M114.5 62 L118.7 63.8 L126.3 46.3 L122.1 44.5 Z" fill="var(--ink)" />
        <path
          d="M128 43 L140 37"
          stroke="var(--green)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M129.5 48 L140.5 45"
          stroke="var(--green)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M125.5 52.5 L134 55.5"
          stroke="var(--green)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Wordmark used beside the crest in the sidebar and on the splash. */
export function LogoWord({ subtitle = "Est. MMXXIV" }: { subtitle?: string }) {
  return (
    <span className="flex min-w-0 flex-col leading-none">
      <span className="gi-display text-[21px] font-semibold tracking-[0.005em]">
        Grip Intelligence
      </span>
      <span className="mt-[5px] text-[9px] tabular-nums tracking-[0.22em] text-[color:var(--faint)] uppercase">
        {subtitle}
      </span>
    </span>
  );
}
