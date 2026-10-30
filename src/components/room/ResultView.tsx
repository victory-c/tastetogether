'use client';

import { copy } from '@/copy/en';
import type { Rating, RecommendationResult, Relaxation } from '@/lib/api-types';
import { Button, Notice } from '@/components/ui';
import { RecommendationCard } from './RecommendationCard';

export function ResultView({
  result,
  solo = false,
  onTryAnother,
  onSelect,
  onVisited,
  onRelax,
  onRetry,
  busy,
  retryDisabled = false,
}: {
  result: RecommendationResult;
  solo?: boolean;
  onTryAnother: (id: string) => void;
  onSelect: (id: string) => void;
  onVisited: (id: string, feedback: { rating: Rating; revisitIntent: boolean }) => void;
  onRelax: (relaxation: Relaxation) => void;
  onRetry: () => void;
  busy: boolean;
  retryDisabled?: boolean;
}) {
  return (
    <section className="space-y-4">
      {result.stale && <Notice tone="warn">{copy.room.stale}</Notice>}
      {result.historyIncomplete && <Notice tone="warn">{copy.room.historyWarning}</Notice>}
      {result.unknowns.length > 0 && (
        <div>
          <h3 className="font-medium">{copy.room.unknowns}</h3>
          <ul className="list-disc pl-5 text-sm">
            {result.unknowns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {result.status === 'success' && (
        <>
          {result.message && <Notice>{result.message}</Notice>}
          {result.decisionMode === 'pick' && <h2 className="text-xl font-semibold">{copy.room.ourPick}</h2>}
          <div className="grid gap-4 md:grid-cols-3">
            {result.cards.slice(0, result.decisionMode === 'pick' ? 1 : 3).map((card) => (
              <RecommendationCard
                key={card.placeId}
                card={card}
                solo={solo}
                busy={busy || result.stale}
                onTryAnother={onTryAnother}
                onSelect={onSelect}
                onVisited={onVisited}
              />
            ))}
          </div>
        </>
      )}
      {result.status === 'needs_clarification' && (
        <>
          <Notice>{result.message ?? copy.status.needs_clarification}</Notice>
          <h3 className="font-medium">{copy.room.clarify}</h3>
          <ul className="list-disc pl-5">
            {result.conditionsToConfirm.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {result.status === 'no_match' && (
        <>
          <Notice>{result.message ?? copy.status.no_match}</Notice>
          <ul className="list-disc pl-5">
            {result.exclusionSummary.map(({ reason, count }) => (
              <li key={reason}>{copy.room.leftOut(count, copy.exclusionReasons[reason])}</li>
            ))}
          </ul>
          <p>{copy.room.relaxChoice}</p>
          <div className="flex flex-wrap gap-2">
            {result.relaxationOptions.map((r) => (
              <Button key={r} variant="secondary" disabled={busy} onClick={() => onRelax(r)}>
                {copy.relaxations[r]}
              </Button>
            ))}
          </div>
        </>
      )}
      {result.status === 'provider_unavailable' && (
        <>
          <Notice tone="warn">{result.message ?? copy.status.provider_unavailable}</Notice>
          <Button disabled={busy || retryDisabled} onClick={onRetry}>
            {copy.room.retry}
          </Button>
        </>
      )}
    </section>
  );
}
