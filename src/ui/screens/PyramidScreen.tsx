import { rowValue } from '../../engine/engine';
import type { Action, GameState, Phase2Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { DrinkIcon } from '../components/icons';
import { PlayerPicker } from '../components/PlayerPicker';

// Render top row first; indexes into stage.pyramid (0-3 = bottom row).
const ROWS = [[9], [7, 8], [4, 5, 6], [0, 1, 2, 3]];

interface Props {
  state: GameState;
  stage: Phase2Stage;
  dispatch: (action: Action) => void;
}

export function PyramidScreen({ state, stage, dispatch }: Props) {
  const head = stage.matchQueue[0];
  const done = stage.flipped >= 10 && !head;

  return (
    <div className="screen">
      <p className="phase-label">Phase 2 — Pyramid</p>
      <div className="pyramid">
        {ROWS.map((row) => (
          <div key={row[0]} className="pyramid-row">
            {row.map((i) => (
              <CardView
                key={i}
                card={stage.pyramid[i]}
                faceDown={i >= stage.flipped}
                glow={i === stage.flipped && !head}
                small
                onClick={i === stage.flipped && !head ? () => dispatch({ type: 'FLIP_PYRAMID_CARD' }) : undefined}
                testId={`pyramid-card-${i}`}
              />
            ))}
            <span className="row-value">
              ×{rowValue(row[0])}
              <DrinkIcon />
            </span>
          </div>
        ))}
      </div>
      <div className="hands">
        {state.players.map((p, i) => (
          <div key={i} className="hand-strip" data-testid={`hand-strip-${i}`}>
            <span className="hand-name">{p.name}</span>
            {stage.hands[i].map((card, j) => (
              <CardView key={`${card.rank}-${card.suit}-${j}`} card={card} small />
            ))}
          </div>
        ))}
      </div>
      {head && (
        <PlayerPicker
          players={state.players}
          exclude={head.playerIndex}
          prompt={`${state.players[head.playerIndex].name} has a match! Assign ${head.drinks} drink${head.drinks > 1 ? 's' : ''} to…`}
          onPick={(toPlayer) => dispatch({ type: 'ASSIGN_DRINKS', toPlayer })}
        />
      )}
      {done && (
        <button className="btn btn-primary" data-testid="to-bus-button" onClick={() => dispatch({ type: 'ADVANCE' })}>
          Who rides the bus?
        </button>
      )}
    </div>
  );
}
