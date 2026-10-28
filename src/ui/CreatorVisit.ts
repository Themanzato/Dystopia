import { loadScores, grantCreatorVisit } from './ScoreStorage';
import { openCreatorLink } from './links';
import type { CreatorSection } from '../game/workshop';

export async function visitCreator(section: CreatorSection, openURL: (url: string) => Promise<unknown>, showError: (message: string) => void) {
  try { await loadScores(); }
  catch { showError('No se pudo leer el saldo. Reintenta antes de abrir el enlace.'); return null; }
  if (!await openCreatorLink(section, openURL, showError)) return null;
  try { return await grantCreatorVisit(section); }
  catch { showError('El enlace se abrió, pero no se guardó la recompensa. Toca otra vez para reintentar.'); return null; }
}
