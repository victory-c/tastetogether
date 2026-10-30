'use client';

import { useState } from 'react';
import { copy } from '@/copy/en';
import type { ParticipantKey, Rating, RecommendationCard as CardType } from '@/lib/api-types';
import { Badge, Button, Card } from '@/components/ui';
import { FeedbackForm } from './FeedbackForm';

export function RecommendationCard({
  card,
  solo,
  names,
  large,
  actionsDisabled,
  feedbackDisabled,
  onTryAnother,
  onSelect,
  onVisited,
}: {
  card: CardType;
  solo: boolean;
  names: Partial<Record<ParticipantKey, string>>;
  large: boolean;
  actionsDisabled: boolean;
  feedbackDisabled: boolean;
  onTryAnother: (id: string) => void;
  onSelect: (id: string) => void;
  onVisited: (id: string, feedback: { rating: Rating; revisitIntent: boolean }) => Promise<boolean>;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return (
    <Card className="min-w-0 overflow-hidden !p-0">
      {card.imageUrl && (
        <img src={card.imageUrl} alt={card.name} loading="lazy" className="aspect-video w-full rounded-t-xl object-cover" />
      )}
      <div className="space-y-3 p-4">
        <h3 className={`${large ? 'text-2xl' : 'text-xl'} break-words font-semibold`}>{card.name}</h3>
        <p className="text-sm text-stone-600">{card.address ?? copy.room.addressUnknown}</p>
        <div className="flex flex-wrap gap-2">
          {card.cuisines.slice(0, 3).map((cuisine, i) => (
            <Badge key={i}>{cuisine}</Badge>
          ))}
          <Badge>{card.priceLevel ? '$'.repeat(card.priceLevel) : copy.labels.priceUnverified}</Badge>
          {card.distanceM != null && (
            <Badge>
              {(card.distanceM / 1609.344).toFixed(1)} mi ({copy.labels.straightLine})
            </Badge>
          )}
          {card.hoursStatus !== 'no_time_given' && <Badge>{copy.hours[card.hoursStatus]}</Badge>}
          {card.novelty === 'new_to_everyone' && <Badge tone="good">{solo ? copy.room.newYou : copy.room.newBoth}</Badge>}
        </div>
        {card.occasionTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {card.occasionTags.map((tag, i) => (
              <Badge key={i}>{copy.room.occasionTag(tag)}</Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(['A', 'B'] as const).map((key) => {
            const rank = card.ranks[key];
            if (!rank || (!solo && !names[key])) return null;
            return (
              <Badge key={key}>{solo ? copy.room.soloFit(rank.rank, rank.of) : copy.room.personFit(names[key]!, rank.rank, rank.of)}</Badge>
            );
          })}
        </div>
        {card.hoursText && <p className="text-sm">{card.hoursText}</p>}
        <p className="text-sm text-stone-500">{copy.labels.waitUnavailable}</p>
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
        <div>
          <button
            type="button"
            className="font-medium text-orange-700 underline"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen(!whyOpen)}
          >
            {copy.room.why}
          </button>
          {whyOpen && (
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
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={actionsDisabled} onClick={() => onTryAnother(card.placeId)}>
            {copy.labels.tryAnother}
          </Button>
          <Button disabled={actionsDisabled} onClick={() => onSelect(card.placeId)}>
            {copy.room.choose}
          </Button>
          <Button variant="secondary" disabled={feedbackDisabled || submitted} onClick={() => setFeedback(!feedback)}>
            {copy.room.visited}
          </Button>
        </div>
        {feedback && (
          <FeedbackForm
            busy={feedbackDisabled}
            onVisited={async (value) => {
              const success = await onVisited(card.placeId, value);
              if (success) {
                setSubmitted(true);
                setFeedback(false);
              }
              return success;
            }}
          />
        )}
      </div>
    </Card>
  );
}
