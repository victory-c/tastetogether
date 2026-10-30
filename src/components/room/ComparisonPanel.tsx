'use client';

import { useState } from 'react';
import { copy } from '@/copy/en';
import type { ParticipantKey, RecommendationResult } from '@/lib/api-types';

export function ComparisonPanel({ result, names }: { result: RecommendationResult; names: Partial<Record<ParticipantKey, string>> }) {
  const [open, setOpen] = useState(false);
  if (result.status !== 'success' || result.perParticipant.length !== 2) return null;

  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
      <button type="button" className="font-medium text-orange-700 underline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {copy.room.seeComparison}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <h2 className="text-xl font-semibold">{copy.room.comparison}</h2>
          <p className="text-sm text-stone-600">{copy.room.comparisonExplanation}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {result.perParticipant.map((person) => (
              <div key={person.key} className="min-w-0">
                <h3 className="font-semibold">{copy.room.alone(names[person.key] ?? person.displayName)}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {person.picks.map((pick) => (
                    <li key={pick.placeId} className="break-words">
                      #{pick.rank} {pick.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="min-w-0">
              <h3 className="font-semibold">{copy.room.together}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {result.cards.map((card) => (
                  <li key={card.placeId} className="break-words">
                    <div className="font-medium">{card.name}</div>
                    {result.perParticipant.map((person) => {
                      const rank = card.ranks[person.key];
                      return rank ? (
                        <div key={person.key}>{copy.room.personFit(names[person.key] ?? person.displayName, rank.rank, rank.of)}</div>
                      ) : null;
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
