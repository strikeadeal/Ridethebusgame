import type { Card, Player } from '../../engine/types';
import { CardView } from './CardView';

interface Props {
  players: Player[];
  exclude: number;
  prompt: string;
  card?: Card;
  onPick: (playerIndex: number) => void;
}

export function PlayerPicker({ players, exclude, prompt, card, onPick }: Props) {
  return (
    <div className="overlay">
      <div className="panel">
        {card && <CardView card={card} />}
        <h2 className="prompt">{prompt}</h2>
        <div className="picker-grid">
          {players.map((p, i) =>
            i === exclude ? null : (
              <button key={i} className="btn btn-pick" data-testid={`pick-player-${i}`} onClick={() => onPick(i)}>
                {p.name}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
