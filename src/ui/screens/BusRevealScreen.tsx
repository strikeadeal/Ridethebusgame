import type { Action, BusRevealStage, GameState } from '../../engine/types';

interface Props {
  state: GameState;
  stage: BusRevealStage;
  dispatch: (action: Action) => void;
}

export function BusRevealScreen({ state, stage, dispatch }: Props) {
  return (
    <div className="screen center">
      <p className="phase-label">Phase 3 — Ride the Bus</p>
      <h2 className="bus-rider reveal-pop" data-testid="bus-rider-name">
        {state.players[stage.riderIndex].name}
      </h2>
      <p className="question">rides the bus! 🚌</p>
      <button className="btn btn-primary" data-testid="bus-deal-button" onClick={() => dispatch({ type: 'ADVANCE' })}>
        Deal the cards
      </button>
    </div>
  );
}
