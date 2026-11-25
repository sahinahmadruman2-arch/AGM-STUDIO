interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function Logo({ size = 28, className = '', animated = false }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        className="fill-slate-900 dark:fill-[#0B1221] stroke-slate-300 dark:stroke-emerald-500/25"
        strokeWidth="1.25"
      />
      <g className={animated ? 'agm-orbit-spin' : undefined}>
        <circle
          cx="16"
          cy="16"
          r="8.5"
          className="stroke-emerald-400/50 dark:stroke-emerald-400/45"
          strokeWidth="1.25"
          strokeDasharray="3 2.5"
        />
        <circle cx="24" cy="9" r="1.5" className="fill-emerald-300" />
      </g>
      <path
        d="M16 7.5L22.5 21.5H19.4L17.95 18.2H14.05L12.6 21.5H9.5L16 7.5ZM16 12.1L14.85 15.6H17.15L16 12.1Z"
        className="fill-emerald-400"
      />
    </svg>
  );
}
