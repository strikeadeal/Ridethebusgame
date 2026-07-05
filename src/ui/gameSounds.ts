import { useEffect, useRef } from 'react';
import type { GameState, Stage } from '../engine/types';
import { play, type SoundName } from './sound';

/** Pure mapping from a stage transition to the sound it should make. */
export function soundForTransition(prev: Stage, next: Stage): SoundName | null {
  if (prev.kind !== next.kind) {
    switch (next.kind) {
      case 'phase1':
      case 'phase3':
        return 'deal';
      case 'phase2':
        return 'rowAdvance';
      case 'busReveal':
        return 'busStart';
      case 'gameOver':
        return 'fanfare';
      default:
        return null;
    }
  }
  if (prev.kind === 'phase1' && next.kind === 'phase1' && !prev.feedback && next.feedback) {
    return next.feedback.correct ? 'correct' : 'wrong';
  }
  if (prev.kind === 'phase3' && next.kind === 'phase3') {
    if (next.attempts > prev.attempts) return 'deal';
    if (!prev.feedback && next.feedback) return next.feedback.correct ? 'correct' : 'wrong';
  }
  if (prev.kind === 'phase2' && next.kind === 'phase2' && next.flipped > prev.flipped) {
    return 'flip';
  }
  return null;
}

/** Watches stage transitions and plays the matching sound. Mount once, in App. */
export function useGameSounds(state: GameState): void {
  const prev = useRef(state.stage);
  useEffect(() => {
    const sound = soundForTransition(prev.current, state.stage);
    prev.current = state.stage;
    if (sound) play(sound);
  }, [state.stage]);
}
