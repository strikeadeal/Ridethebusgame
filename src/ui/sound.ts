import { Howl } from 'howler';

export type SoundName =
  | 'deal'
  | 'flip'
  | 'correct'
  | 'wrong'
  | 'rowAdvance'
  | 'busStart'
  | 'fanfare';

const KEY = 'ridethebus:muted:v1';
const howls = new Map<SoundName, Howl>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Preference is best-effort, like game saves.
  }
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export function play(name: SoundName): void {
  if (isMuted()) return;
  let howl = howls.get(name);
  if (!howl) {
    howl = new Howl({ src: [`${import.meta.env.BASE_URL}sounds/${name}.wav`] });
    howls.set(name, howl);
  }
  howl.play();
}
