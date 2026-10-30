import type { InterestKind, OpenStatus } from '../taste/types';

export const KIND_LABEL: Record<InterestKind, string> = {
  artist: 'Music',
  movie: 'Film',
  tv_show: 'TV',
  book: 'Book',
  podcast: 'Podcast',
  video_game: 'Game',
};

export const KIND_EMOJI: Record<InterestKind, string> = {
  artist: '🎧',
  movie: '🎬',
  tv_show: '📺',
  book: '📖',
  podcast: '🎙️',
  video_game: '🎮',
};

export function price(level?: number | null) {
  return level ? '$'.repeat(level) : null;
}

export function distance(m?: number) {
  if (m === undefined) return null;
  const miles = m / 1609.34;
  if (miles < 0.2) return `${Math.round((m * 3.28084) / 10) * 10} ft away`;
  return `${miles.toFixed(1)} mi away`;
}

export function walkMinutes(m?: number) {
  if (m === undefined) return null;
  return Math.max(1, Math.round(m / 80));
}

/** `when` is the plan time label from the server, e.g. "Tonight · 7 PM". */
export function openLabel(o: OpenStatus, when = 'Tonight · 7 PM'): { text: string; tone: 'good' | 'wait' | 'bad' | 'unknown' } {
  const [day = 'Tonight', time = ''] = when.split(' · ');
  const dayWord = day.toLowerCase();
  switch (o.kind) {
    case 'open':
      return { text: `Open ${dayWord}${time ? ` at ${time}` : ''} · until ${o.until}`, tone: 'good' };
    case 'opens_later':
      return { text: `Opens ${dayWord} at ${o.at}`, tone: 'wait' };
    case 'closed_by_then':
      return { text: `Closed by ${time || 'then'} ${dayWord}`.trim(), tone: 'bad' };
    case 'closed_today':
      return { text: `Closed ${dayWord}`, tone: 'bad' };
    default:
      return { text: 'Hours unverified', tone: 'unknown' };
  }
}

export function ordinalFit(rank: number, of: number) {
  const pct = rank / of;
  if (rank === 1) return 'Top pick';
  if (pct <= 0.1) return 'Top 10%';
  if (pct <= 0.25) return 'Top 25%';
  if (pct <= 0.5) return 'Good fit';
  return 'Fair fit';
}
