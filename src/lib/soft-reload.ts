import { navigate } from 'astro:transitions/client';

// Show fresh server data without a full browser reload. A real reload (location.reload(),
// location.href = …) restarts the page and with it the music player; a ClientRouter
// navigation swaps the body and keeps the persisted player (and dice tray) playing.

/** Re-render the current page from the server and stay where the reader was scrolled. */
export function softReload(): Promise<void> {
  const { scrollX, scrollY } = window;
  document.addEventListener('astro:after-swap', () => window.scrollTo(scrollX, scrollY), { once: true });
  // Without the #hash: the router takes the same URL with a hash for a jump within the page and fetches nothing
  const url = new URL(location.href);
  url.hash = '';
  return navigate(url.href, { history: 'replace' });
}

/** Go to another page of the app without a full reload. */
export function goTo(href: string): Promise<void> {
  return navigate(href);
}

// Also on window, for inline scripts (define:vars) that cannot import.
declare global {
  interface Window {
    arandorSoftReload: typeof softReload;
    arandorGoTo: typeof goTo;
  }
}
window.arandorSoftReload = softReload;
window.arandorGoTo = goTo;
