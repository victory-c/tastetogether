'use client';

import { useState } from 'react';
import { copy } from '@/copy/en';
import type { Rating, RecommendationCard as CardType } from '@/lib/api-types';
import { Badge, Button, Card } from '@/components/ui';
import { FeedbackForm } from './FeedbackForm';

export function RecommendationCard({
  card,
  solo,
  busy,
  onTryAnother,
  onSelect,
  onVisited,
}: {
  card: CardType;
  solo: boolean;
  busy: boolean;
  onTryAnother: (id: string) => void;
  onSelect: (id: string) => void;
  onVisited: (id: string, feedback: { rating: Rating; revisitIntent: boolean }) => void;
}) {
  const [feedback, setFeedback] = useState(false);
  return (
    <Card className="space-y-3">
      <h3 className="text-xl font-semibold">{card.name}</h3>
      <p>{card.address ?? copy.room.addressUnknown}</p>
      {card.cuisines.length > 0 && <p>{card.cuisines.join(', ')}</p>}
      <div className="flex flex-wrap gap-2">
        <Badge>{card.priceLevel ? '$'.repeat(card.priceLevel) : copy.labels.priceUnverified}</Badge>
        {card.distanceM != null && (
          <Badge>
            {(card.distanceM / 1609.344).toFixed(1)} mi ({copy.labels.straightLine})
          </Badge>
        )}
        <Badge>{copy.hours[card.hoursStatus]}</Badge>
        {card.novelty === 'new_to_everyone' && <Badge tone="good">{solo ? copy.room.newYou : copy.room.newBoth}</Badge>}
        <Badge>{copy.labels.waitUnavailable}</Badge>
      </div>
      {card.hoursText && <p className="text-sm">{card.hoursText}</p>}
      {card.reasons.length > 0 && (
        <ul className="list-disc pl-5">
          {card.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
      {card.links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {card.links.map((link, i) => (
            <a className="text-orange-700 underline" key={i} href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      )}
      <details>
        <summary className="cursor-pointer font-medium">{copy.room.why}</summary>
        <div className="space-y-2 pt-2">
          {[
            [copy.room.fromYou, card.evidence.userProvided],
            [copy.room.qlooSignals, card.evidence.qlooSignals],
            [
              copy.room.venueFacts,
              card.evidence.venueFacts.map((fact) => `${fact.value} (${fact.source === 'qloo' ? 'Qloo' : 'Computed'})`),
            ],
          ].map(([label, items]) => (
            <div key={label as string}>
              <h4 className="font-medium">{label}</h4>
              <ul className="list-disc pl-5">
                {(items as string[]).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => onTryAnother(card.placeId)}>
          {copy.labels.tryAnother}
        </Button>
        <Button disabled={busy} onClick={() => onSelect(card.placeId)}>
          {copy.room.choose}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setFeedback(!feedback)}>
          {copy.room.visited}
        </Button>
      </div>
      {feedback && <FeedbackForm busy={busy} onVisited={(value) => onVisited(card.placeId, value)} />}
    </Card>
  );
}
