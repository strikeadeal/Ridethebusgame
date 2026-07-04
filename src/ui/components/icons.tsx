import type { ReactNode } from 'react';
import type { GuessAnswer } from '../../engine/types';

interface IconProps {
  size?: number;
}

function Svg({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className="answer-icon"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* Color chips for Red or Black — card-stock suit colors ringed in brass. */
function RedChip() {
  return (
    <Svg>
      <circle cx="9" cy="9" r="6.5" fill="#7f1d24" stroke="#b08d4f" />
    </Svg>
  );
}

function BlackChip() {
  return (
    <Svg>
      <circle cx="9" cy="9" r="6.5" fill="#1e1b16" stroke="#b08d4f" />
    </Svg>
  );
}

function ChevronUp() {
  return (
    <Svg>
      <path d="M4 11.5 9 6.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDown() {
  return (
    <Svg>
      <path d="M4 6.5 9 11.5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* Two arrowheads pointing inward: between the outer cards. */
function ArrowsIn() {
  return (
    <Svg>
      <path d="M2 5.5 5.5 9 2 12.5M16 5.5 12.5 9 16 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* Two arrowheads pointing outward: beyond the outer cards. */
function ArrowsOut() {
  return (
    <Svg>
      <path d="M5.5 5.5 2 9l3.5 3.5M12.5 5.5 16 9l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* Line-art rocks glass, for drink tallies. */
export function DrinkIcon({ size = 14 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 3h10l-1.2 11a1.6 1.6 0 0 1-1.6 1.4H6.8a1.6 1.6 0 0 1-1.6-1.4L4 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.7 9.5h8.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

/* Line-art bus mark, gold via currentColor. */
export function BusIcon({ size = 28 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="2.5" y="4" width="13" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 9.5h12" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4.6" y="5.8" width="2.4" height="2" rx="0.5" fill="currentColor" />
      <rect x="7.8" y="5.8" width="2.4" height="2" rx="0.5" fill="currentColor" />
      <rect x="11" y="5.8" width="2.4" height="2" rx="0.5" fill="currentColor" />
      <circle cx="5.8" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.2" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export const ANSWER_ICONS: Record<GuessAnswer, ReactNode> = {
  red: <RedChip />,
  black: <BlackChip />,
  higher: <ChevronUp />,
  lower: <ChevronDown />,
  inside: <ArrowsIn />,
  outside: <ArrowsOut />,
  hearts: <span className="pip-red">♥</span>,
  diamonds: <span className="pip-red">♦</span>,
  clubs: <span className="pip-black">♣</span>,
  spades: <span className="pip-black">♠</span>,
};
