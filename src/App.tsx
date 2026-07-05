import { useEffect, useReducer, useState } from 'react';
import { createInitialState, reduce } from './engine/engine';
import { Scoreboard } from './ui/components/Scoreboard';
import { BusRevealScreen } from './ui/screens/BusRevealScreen';
import { BusScreen } from './ui/screens/BusScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { Phase1Screen } from './ui/screens/Phase1Screen';
import { PyramidScreen } from './ui/screens/PyramidScreen';
import { SetupScreen } from './ui/screens/SetupScreen';
import { newSeed } from './ui/seed';
import { loadGame, saveGame } from './ui/storage';
import { useGameSounds } from './ui/gameSounds';
import { useWakeLock } from './ui/wakeLock';

type Screen = 'home' | 'setup' | 'game';

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () => loadGame() ?? createInitialState());
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    saveGame(state);
  }, [state]);

  const { stage } = state;
  const inProgress = stage.kind !== 'idle' && stage.kind !== 'gameOver';
  useWakeLock(screen === 'game' && inProgress);
  useGameSounds(state);

  if (screen === 'home') {
    return (
      <HomeScreen
        canResume={inProgress}
        onResume={() => setScreen('game')}
        onNewGame={() => setScreen('setup')}
      />
    );
  }

  if (screen === 'setup' || stage.kind === 'idle') {
    return (
      <SetupScreen
        onStart={(names) => {
          dispatch({ type: 'START_GAME', names, seed: newSeed() });
          setScreen('game');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <div className="app">
      {stage.kind !== 'gameOver' && <Scoreboard players={state.players} />}
      {stage.kind === 'phase1' && <Phase1Screen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'phase2' && <PyramidScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'busReveal' && <BusRevealScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'phase3' && <BusScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'gameOver' && (
        <GameOverScreen
          state={state}
          stage={stage}
          onPlayAgain={() =>
            dispatch({ type: 'START_GAME', names: state.players.map((p) => p.name), seed: newSeed() })
          }
          onNewGame={() => setScreen('setup')}
        />
      )}
    </div>
  );
}
