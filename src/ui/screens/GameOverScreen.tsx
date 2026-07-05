import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { GameOverStage, GameState } from '../../engine/types';
import { buildShareText, shareResults, type ShareOutcome } from '../share';
import { DrinkIcon } from '../components/icons';

// Felt-table palette: gold, ivory, brass — never rainbow.
const CONFETTI_COLORS = ['#d4af5f', '#f3e9d2', '#8c6a2f', '#f6f1e3'];

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface Props {
  state: GameState;
  stage: GameOverStage;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function GameOverScreen({ state, stage, onPlayAgain, onNewGame }: Props) {
  const reduced = useReducedMotion();
  const [shared, setShared] = useState<ShareOutcome>('idle');
  useEffect(() => {
    if (reduced) return;
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.35 },
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    });
  }, [reduced]);

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
      <motion.div
        className="final-board"
        data-testid="gameover-scoreboard"
        initial={reduced ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {sorted.map((p, rank) => (
          <motion.div key={p.i} className={rank === 0 ? 'score score-top' : 'score'} variants={row}>
            <span className="score-name">{p.name}</span>
            <span className="score-drinks">
              {p.drinks} <DrinkIcon />
            </span>
          </motion.div>
        ))}
      </motion.div>
      <button
        className="btn"
        data-testid="gameover-share"
        onClick={async () => setShared(await shareResults(buildShareText(state, stage)))}
      >
        {shared === 'copied' ? 'Copied!' : shared === 'shared' ? 'Shared!' : 'Share results'}
      </button>
      <button className="btn btn-primary" data-testid="gameover-again" onClick={onPlayAgain}>
        Play again
      </button>
      <button className="btn" data-testid="gameover-new" onClick={onNewGame}>
        New game
      </button>
    </div>
  );
}
