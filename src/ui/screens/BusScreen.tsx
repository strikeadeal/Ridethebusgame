import { QUESTION_ANSWERS } from '../../engine/engine';
import type { Action, GameState, Phase3Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { ANSWER_LABELS, QUESTION_TEXT } from '../labels';

interface Props {
  state: GameState;
  stage: Phase3Stage;
  dispatch: (action: Action) => void;
}

export function BusScreen({ state, stage, dispatch }: Props) {
  const rider = state.players[stage.riderIndex];
  const revealedCount = stage.position + (stage.feedback ? 1 : 0);

  return (
    <div className="screen">
      <p className="phase-label">Phase 3 — Ride the Bus</p>
      <h2 className="turn-banner" data-testid="turn-banner">{rider.name} 🚌</h2>
      <p className="attempts" data-testid="bus-attempts">Attempt #{stage.attempts}</p>
      <p className="question" data-testid="question">{QUESTION_TEXT[stage.position]}</p>
      <div className="card-row">
        {stage.cards.map((card, i) => (
          <CardView
            key={`${stage.attempts}-${i}`}
            card={card}
            faceDown={i >= revealedCount}
            testId={`bus-card-${i}`}
          />
        ))}
      </div>
      {!stage.feedback && (
        <div className="answers">
          {QUESTION_ANSWERS[stage.position].map((answer) => (
            <button
              key={answer}
              className="btn btn-answer"
              data-testid={`answer-${answer}`}
              onClick={() => dispatch({ type: 'GUESS', answer })}
            >
              {ANSWER_LABELS[answer]}
            </button>
          ))}
        </div>
      )}
      {stage.feedback && (
        <div className="overlay">
          <div className="panel">
            <h2
              className={stage.feedback.correct ? 'verdict verdict-right' : 'verdict verdict-wrong'}
              data-testid="verdict"
            >
              {stage.feedback.correct
                ? stage.position === 3
                  ? 'OFF THE BUS! 🎉'
                  : 'CORRECT!'
                : 'DRINK! Back to the start 🍺'}
            </h2>
            <CardView card={stage.feedback.card} />
            <button
              className="btn btn-primary"
              data-testid="feedback-continue"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              {stage.feedback.correct ? 'Continue' : 'New cards'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
