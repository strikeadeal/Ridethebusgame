import type { Player } from '../../engine/types';
import { SoundToggle } from './SoundToggle';

export function Scoreboard({ players }: { players: Player[] }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => (
        <div key={i} className="score">
          <span className="score-name">{p.name}</span>
          <span className="score-drinks" data-testid={`scoreboard-drinks-${i}`}>
            {p.drinks}
          </span>
        </div>
      ))}
      <SoundToggle />
    </div>
  );
}
