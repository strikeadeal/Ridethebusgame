import { useState } from 'react';
import { isMuted, toggleMuted } from '../sound';

const SpeakerOn = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

const SpeakerOff = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      className="btn-icon"
      data-testid="sound-toggle"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      onClick={() => setMutedState(toggleMuted())}
    >
      {muted ? SpeakerOff : SpeakerOn}
    </button>
  );
}
