/** Where a link opens: inside the app, in whatever app owns its scheme, or nowhere. */
export type LinkTarget = 'in-app' | 'system' | 'refuse';

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const WEB_HOST = /^https?:\/\/[^/?#\s]+/i;
const NEVER_OPENED = new Set(['javascript', 'data', 'file', 'vbscript', 'blob', 'about']);

/**
 * The one policy for every link a person taps. Web links open in the app; mail, phone, other
 * apps and this app's own deep links go to the system; anything empty, malformed or able to run
 * code or read local files is refused. Text without a scheme is never guessed into a URL.
 */
export function linkTarget(url: string): LinkTarget {
  const text = url.trim();
  const scheme = SCHEME.exec(text)?.[1]?.toLowerCase();
  if (!scheme || /\s/.test(text) || NEVER_OPENED.has(scheme)) return 'refuse';
  if (scheme === 'http' || scheme === 'https') return WEB_HOST.test(text) ? 'in-app' : 'refuse';
  return text.length > scheme.length + 1 ? 'system' : 'refuse';
}
