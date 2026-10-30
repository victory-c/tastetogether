'use client';

import { useId, useState } from 'react';
import { copy } from '@/copy/en';
import type { Rating } from '@/lib/api-types';
import { Button } from '@/components/ui';

export function FeedbackForm({
  onVisited,
  busy,
}: {
  onVisited: (feedback: { rating: Rating; revisitIntent: boolean }) => Promise<boolean>;
  busy: boolean;
}) {
  const group = useId();
  const [rating, setRating] = useState<Rating | ''>('');
  const [revisit, setRevisit] = useState('');
  return (
    <form
      className="space-y-3 border-t border-stone-200 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating && revisit) void onVisited({ rating, revisitIntent: revisit === 'yes' });
      }}
    >
      <h4 className="font-semibold">{copy.room.feedbackTitle}</h4>
      <p className="text-sm">{copy.room.feedbackNote}</p>
      <fieldset>
        <legend>{copy.room.rating}</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ['liked', copy.room.loved],
              ['neutral', copy.room.okay],
              ['disliked', copy.room.disliked],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name={`${group}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} />{' '}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{copy.room.revisit}</legend>
        <div className="flex gap-3">
          {(
            [
              ['yes', copy.room.yes],
              ['no', copy.room.no],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name={`${group}-revisit`} value={value} checked={revisit === value} onChange={() => setRevisit(value)} />{' '}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button disabled={busy || !rating || !revisit} type="submit">
        {copy.room.submit}
      </Button>
    </form>
  );
}
