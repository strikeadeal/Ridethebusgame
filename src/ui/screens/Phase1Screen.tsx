import { QUESTION_ANSWERS } from '../../engine/engine';
import type { Action, GameState, Phase1Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { PlayerPicker } from '../components/PlayerPicker';
import { ANSWER_ICONS } from '../components/icons';
import { ANSWER_LABELS, QUESTION_TEXT } from '../labels';

interface Props {
  state: GameState;
  stage: Phase1Stage;
  dispatch: (action: Action) => void;
}

export function Phase1Screen({ state, stage, dispatch }: Props) {
  const player = state.players[stage.playerIndex];
  const hand = stage.hands[stage.playerIndex];
  // Rounds reveal one card per question; the current card shows once feedback exists.
  const revealedCount = stage.questionIndex + (stage.feedback ? 1 : 0);

  return (
    <div className="screen">
      <p className="phase-label">Phase 1 — Four Questions</p>
      <h2 className="turn-banner" data-testid="turn-banner">{player.name}</h2>
      <p className="question" data-testid="question">{QUESTION_TEXT[stage.questionIndex]}</p>
      <div className="card-row">
        {hand.map((card, i) => (
          <CardView key={i} card={card} faceDown={i >= revealedCount} testId={`p1-card-${i}`} dealDelay={i * 0.05} />
        ))}
      </div>
      {!stage.feedback && (
        <div className="answers">
          {QUESTION_ANSWERS[stage.questionIndex].map((answer) => (
            <button
              key={answer}
              className="btn btn-answer"
              data-testid={`answer-${answer}`}
              onClick={() => dispatch({ type: 'GUESS', answer })}
            >
              {ANSWER_ICONS[answer]}
              {ANSWER_LABELS[answer]}
            </button>
          ))}
        </div>
      )}
      {stage.feedback && !stage.feedback.correct && (
        <div className="overlay">
          <div className="panel">
            <h2 className="verdict verdict-wrong" data-testid="verdict">DRINK!</h2>
            <CardView card={stage.feedback.card} />
            <button
              className="btn btn-primary"
              data-testid="feedback-continue"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {stage.feedback?.correct && (
        <PlayerPicker
          players={state.players}
          exclude={stage.playerIndex}
          prompt={`Correct! ${player.name} gives 1 drink to…`}
          card={stage.feedback.card}
          onPick={(toPlayer) => dispatch({ type: 'ASSIGN_DRINKS', toPlayer })}
        />
      )}
    </div>
  );
}
