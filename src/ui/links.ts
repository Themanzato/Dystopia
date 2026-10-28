/** External destinations are intentionally opened by the OS, never inside the game. */
export const CREATOR_LINKS = {
  support: 'https://buymeacoffee.com/manzato',
  about: 'https://portfolio-two-gamma-if8rur9x6r.vercel.app/',
};
export async function openCreatorLink(
  destination: keyof typeof CREATOR_LINKS,
  openURL: (url: string) => Promise<unknown>,
  showError: (message: string) => void,
): Promise<boolean> {
  try { await openURL(CREATOR_LINKS[destination]); return true; }
  catch { showError('No se pudo abrir el navegador. Comprueba tu conexión e inténtalo de nuevo.'); return false; }
}
