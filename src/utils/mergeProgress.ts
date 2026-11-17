import { LineProgress } from '../types/chess';

// Prefer the more recently practiced record as a whole: stale guest mastery must
// not undo a newer account review. Max counters avoid double-counting on retries.
export function mergeGuestProgress(guest: LineProgress, cloud?: LineProgress): LineProgress {
  if (!cloud) return guest;
  if (
    Date.parse(cloud.lastPracticedAt) >= Date.parse(guest.lastPracticedAt) &&
    cloud.attempts >= guest.attempts &&
    cloud.mistakes >= guest.mistakes
  )
    return cloud;
  const newer =
    Date.parse(guest.lastPracticedAt) > Date.parse(cloud.lastPracticedAt) ? guest : cloud;
  return {
    ...newer,
    attempts: Math.max(guest.attempts, cloud.attempts),
    mistakes: Math.max(guest.mistakes, cloud.mistakes),
  };
}
