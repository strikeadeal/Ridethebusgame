import type { GameOverStage, GameState } from '../../engine/types';
import { DrinkIcon } from '../components/icons';

interface Props {
  state: GameState;
  stage: GameOverStage;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function GameOverScreen({ state, stage, onPlayAgain, onNewGame }: Props) {
  const sorted = state.players
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.drinks - a.drinks);
  return (
    <div className="screen center">
      <h1 className="logo">GAME OVER</h1>
      <p className="question">
        {state.players[stage.riderIndex].name} escaped the bus after {stage.attempts} attempt
        {stage.attempts === 1 ? '' : 's'}
      </p>
      <div className="final-board" data-testid="gameover-scoreboard">
        {sorted.map((p, rank) => (
          <div key={p.i} className={rank === 0 ? 'score score-top' : 'score'}>
            <span className="score-name">{p.name}</span>
            <span className="score-drinks">
              {p.drinks} <DrinkIcon />
            </span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" data-testid="gameover-again" onClick={onPlayAgain}>
        Play again
      </button>
      <button className="btn" data-testid="gameover-new" onClick={onNewGame}>
        New game
      </button>
    </div>
  );
}
