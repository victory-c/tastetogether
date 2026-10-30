'use client';

import { useEffect, useState } from 'react';
import { Button, Field, inputClass, Notice } from '@/components/ui';
import { copy } from '@/copy/en';
import { api, ApiClientError } from '@/lib/api-client';
import type { PlaceSearchResponse, PlaceSearchResult } from '@/lib/api-types';

export function PlacePicker({
  onPick,
  query,
  onQueryChange,
}: {
  onPick: (place: PlaceSearchResult) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const text = query.trim();
    setResults([]);
    setSearched(false);
    setError('');
    setLoading(false);
    if (text.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<PlaceSearchResponse>(`/api/places/search?q=${encodeURIComponent(text)}`);
        if (active) {
          setResults(data.results);
          setSearched(true);
        }
      } catch (err) {
        if (active) setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="space-y-2">
      <Field label={copy.taste.search}>
        <input className={inputClass} value={query} onChange={(e) => onQueryChange(e.target.value)} />
      </Field>
      {loading && (
        <p role="status" className="text-sm">
          {copy.taste.searching}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {searched && !results.length && <p className="text-sm text-stone-600">{copy.taste.noResults}</p>}
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((place) => (
            <li key={place.placeId}>
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-start text-left"
                onClick={() => {
                  onPick(place);
                  onQueryChange('');
                }}
              >
                <span>
                  {place.name}
                  <span className="block font-normal text-stone-600">{place.address || copy.taste.addressUnknown}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
