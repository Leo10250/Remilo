// Synthetic share outcomes; this fixture never opens a share sheet or sends a file.
const reviewShare = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('reviewShare');
let attempts = 0;
export async function isAvailableAsync() { return reviewShare === 'failed-once'; }
export async function shareAsync() {
  if (attempts++ === 0) throw new Error('Synthetic preview: share sheet unavailable.');
}
