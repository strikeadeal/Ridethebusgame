import { useState } from 'react';

interface Props {
  canResume: boolean;
  onResume: () => void;
  onNewGame: () => void;
}

export function HomeScreen({ canResume, onResume, onNewGame }: Props) {
  const [showRules, setShowRules] = useState(false);
  return (
    <div className="screen center">
      <h1 className="logo">
        RIDE THE
        <br />
        BUS
      </h1>
      <span className="ornament">
        <span className="ornament-pip">♦</span>
      </span>
      <button className="btn btn-primary" data-testid="home-new-game" onClick={onNewGame}>
        New Game
      </button>
      {canResume && (
        <button className="btn" data-testid="home-resume" onClick={onResume}>
          Resume Game
        </button>
      )}
      <button className="btn btn-ghost" onClick={() => setShowRules(true)}>
        How to play
      </button>
      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="panel rules">
            <h2>How to play</h2>
            <p>
              <strong>Phase 1 — Four Questions.</strong> Each player guesses their four cards in
              rounds: Red or Black, Higher or Lower, Inside or Outside, then the Suit. Ties are
              wrong. Wrong = drink. Right = give a drink to someone else.
            </p>
            <p>
              <strong>Phase 2 — Pyramid.</strong> Ten cards flip bottom row to top. Hold a matching
              rank and you hand out that row's drinks: 1, 2, 3, then 4 for the top card. Matches
              stack.
            </p>
            <p>
              <strong>Phase 3 — Ride the Bus.</strong> Whoever drank the most rides. Answer all four
              questions in a row — every miss is a drink, fresh cards, back to the start.
            </p>
            <button className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
