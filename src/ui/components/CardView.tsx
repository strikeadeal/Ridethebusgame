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
}

export function CardView({ card, faceDown = false, small = false, glow = false, onClick, testId }: Props) {
  const face = !faceDown && card !== undefined ? card : null;
  const cls = [
    'card',
    small && 'card-small',
    !face && 'card-down',
    glow && 'card-glow',
    face && (isRed(face) ? 'card-red' : 'card-black'),
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={!onClick} data-testid={testId}>
      {face && (
        <>
          <span className="card-rank">{rankLabel(face.rank)}</span>
          <span className="card-suit">{SUIT_GLYPH[face.suit]}</span>
        </>
      )}
    </button>
  );
}
