import { motion, useReducedMotion } from 'framer-motion';
import { isRed } from '../../engine/rules';
import type { Card } from '../../engine/types';
import { rankLabel, SUIT_GLYPH } from '../labels';

interface Props {
  card?: Card;
  faceDown?: boolean;
  small?: boolean;
  glow?: boolean;
  onClick?: () => void;
  testId?: string;
  /** Seconds to delay the mount deal-in; pass index * 0.05 to stagger a row. */
  dealDelay?: number;
}

export function CardView({
  card,
  faceDown = false,
  small = false,
  glow = false,
  onClick,
  testId,
  dealDelay = 0,
}: Props) {
  const reduced = useReducedMotion();
  const face = !faceDown && card !== undefined ? card : null;
  const faceCls = (...extra: (string | false | null)[]) =>
    ['card', small && 'card-small', glow && 'card-glow', ...extra].filter(Boolean).join(' ');
  return (
    <motion.button
      className={small ? 'card-scene card-scene-small' : 'card-scene'}
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      initial={reduced ? false : { y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 26, delay: dealDelay }}
      whileTap={onClick && !reduced ? { scale: 0.94 } : undefined}
    >
      <motion.span
        className="card-flipper"
        initial={false}
        animate={{ rotateY: face ? 0 : 180 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
      >
        <span className={faceCls(face && (isRed(face) ? 'card-red' : 'card-black'))}>
          {face && (
            <>
              <span className="card-index">
                {rankLabel(face.rank)}
                <span className="card-index-suit">{SUIT_GLYPH[face.suit]}</span>
              </span>
              <span className="card-pip">{SUIT_GLYPH[face.suit]}</span>
              <span className="card-index card-index-br" aria-hidden="true">
                {rankLabel(face.rank)}
                <span className="card-index-suit">{SUIT_GLYPH[face.suit]}</span>
              </span>
            </>
          )}
        </span>
        <span className={faceCls('card-down', 'card-back-face')} />
      </motion.span>
    </motion.button>
  );
}
