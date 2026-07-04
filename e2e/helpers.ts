import { QUESTION_ANSWERS, reduce } from '../src/engine/engine';
import type { GameState, GuessAnswer } from '../src/engine/types';

/** The answer the engine says is correct for the current question — or the
 *  first option when every answer loses (tie cards). */
export function bestAnswer(state: GameState, questionIndex: number): GuessAnswer {
  const candidates = QUESTION_ANSWERS[questionIndex];
  for (const answer of candidates) {
    const next = reduce(state, { type: 'GUESS', answer });
    const stage = next.stage;
    if ((stage.kind === 'phase1' || stage.kind === 'phase3') && stage.feedback?.correct) {
      return answer;
    }
  }
  return candidates[0];
}
