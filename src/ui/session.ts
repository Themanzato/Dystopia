import { createContext, useContext } from 'react';
import type { SpecialEnemyId } from '../game/purgatorio';
import type { Difficulty } from '../game/difficulty';
type Session = { tutorial: boolean; openTutorial: () => void; beginTutorial: () => void; skipTutorial: () => void; openMissions: () => void; openWorkshop: () => void; openScores: () => void; openPurgatorio: () => void; startPurgatorio: (encounter: SpecialEnemyId | 'infinite') => void; setDifficulty: (difficulty: Difficulty) => void; playing: boolean; difficulty: Difficulty; start: (difficulty?: Difficulty) => void; selectDifficulty: () => void;
  abandon: () => void; pause: () => void; resume: () => void; settings: () => void; closeSettings: () => void };
export const SessionContext = createContext<Session>({ tutorial: false, openTutorial: () => {}, beginTutorial: () => {}, skipTutorial: () => {}, openMissions: () => {}, openWorkshop: () => {}, openScores: () => {}, openPurgatorio: () => {}, startPurgatorio: () => {}, setDifficulty: () => {}, playing: false, difficulty: 'easy', start: () => {}, selectDifficulty: () => {}, abandon: () => {}, pause: () => {}, resume: () => {}, settings: () => {}, closeSettings: () => {} });
export const useSession = () => useContext(SessionContext);
