import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../engine/engine';

interface Props {
  onStart: (names: string[]) => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name || names.length >= MAX_PLAYERS) return;
    setNames([...names, name]);
    setDraft('');
  };

  return (
    <div className="screen center">
      <h2 className="turn-banner">Who's playing?</h2>
      <form
        className="setup-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="input"
          data-testid="setup-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Player name"
          maxLength={12}
          enterKeyHint="done"
        />
        <button type="submit" className="btn" data-testid="setup-add-player">
          Add
        </button>
      </form>
      <div className="setup-list">
        {names.map((n, i) => (
          <div key={i} className="setup-player" data-testid={`setup-player-${i}`}>
            <span>{n}</span>
            <button className="btn btn-ghost" onClick={() => setNames(names.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary"
        data-testid="setup-start"
        disabled={names.length < MIN_PLAYERS}
        onClick={() => onStart(names)}
      >
        Start ({names.length} player{names.length === 1 ? '' : 's'})
      </button>
      <button className="btn btn-ghost" onClick={onBack}>
        ‹ Back
      </button>
    </div>
  );
}
