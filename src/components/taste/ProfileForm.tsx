'use client';

import { useState } from 'react';
import { Badge, Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { PlacePicker } from '@/components/taste/PlacePicker';
import { copy } from '@/copy/en';
import { CUISINE_OPTIONS } from '@/domain/cuisines';
import { api, ApiClientError } from '@/lib/api-client';
import type { PriceLevel, ProfileDTO, ProfileInput, ProfileResponse } from '@/lib/api-types';

const areas = [
  { label: copy.taste.areas.downtown, lat: 37.8716, lon: -122.2727 },
  { label: copy.taste.areas.north, lat: 37.8796, lon: -122.269 },
  { label: copy.taste.areas.southside, lat: 37.8665, lon: -122.2588 },
  { label: copy.taste.areas.elmwood, lat: 37.858, lon: -122.253 },
  { label: copy.taste.areas.rockridge, lat: 37.8443, lon: -122.2512 },
];
const radii = [
  { label: copy.taste.miles(1), value: 1609 },
  { label: copy.taste.miles(2), value: 3219 },
  { label: copy.taste.miles(3), value: 4828 },
  { label: copy.taste.miles(5), value: 8047 },
];

export function ProfileForm({ profile, onSaved }: { profile: ProfileDTO | null; onSaved: (profile: ProfileDTO) => void }) {
  const [form, setForm] = useState<ProfileInput>(
    profile ?? { displayName: '', area: { ...areas[0]!, radiusM: 3219 }, priceMax: null, excludedCuisines: [], positiveEntities: [] },
  );
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const demo = profile?.isDemo ?? false;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const { profile: result } = await api<ProfileResponse>('/api/profile', { method: 'PUT', body: form });
      if (!result) throw new ApiClientError('internal', copy.errors.internal);
      onSaved(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <form className="space-y-5" onSubmit={submit}>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{copy.taste.profile}</h2>
          {demo && <Badge tone="sample">{copy.sampleBadge}</Badge>}
        </div>
        {demo && <Notice>{copy.taste.sampleHint}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice>{copy.taste.saved}</Notice>}
        <fieldset disabled={demo || busy} className="space-y-5 disabled:opacity-70">
          <Field label={copy.taste.name}>
            <input
              className={inputClass}
              required
              maxLength={40}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </Field>
          <Field label={copy.taste.area}>
            <select
              className={inputClass}
              value={form.area.label}
              onChange={(e) => {
                const area = areas.find((a) => a.label === e.target.value);
                if (area) setForm({ ...form, area: { ...area, radiusM: form.area.radiusM } });
              }}
            >
              {!areas.some((a) => a.label === form.area.label) && <option value={form.area.label}>{form.area.label}</option>}
              {areas.map((area) => (
                <option key={area.label}>{area.label}</option>
              ))}
            </select>
          </Field>
          <Field label={copy.taste.radius}>
            <select
              className={inputClass}
              value={form.area.radiusM}
              onChange={(e) => setForm({ ...form, area: { ...form.area, radiusM: Number(e.target.value) } })}
            >
              {!radii.some((r) => r.value === form.area.radiusM) && (
                <option value={form.area.radiusM}>{copy.taste.meters(form.area.radiusM)}</option>
              )}
              {radii.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.taste.price} hint={copy.taste.priceHint}>
            <select
              className={inputClass}
              value={form.priceMax ?? ''}
              onChange={(e) => setForm({ ...form, priceMax: e.target.value ? (Number(e.target.value) as PriceLevel) : null })}
            >
              <option value="">{copy.taste.noLimit}</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {'$'.repeat(n)}
                </option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">{copy.taste.cuisines}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CUISINE_OPTIONS.map((option) => (
                <label key={option.key} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.excludedCuisines.includes(option.key)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        excludedCuisines: e.target.checked
                          ? [...form.excludedCuisines, option.key]
                          : form.excludedCuisines.filter((x) => x !== option.key),
                      })
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <h3 className="font-medium">{copy.taste.places}</h3>
            <p className="text-sm text-stone-600">
              {copy.taste.placeHint} {copy.taste.count(form.positiveEntities.length)}
            </p>
            <PlacePicker
              query={query}
              onQueryChange={setQuery}
              onPick={(p) =>
                setForm({
                  ...form,
                  positiveEntities: form.positiveEntities.some((x) => x.id === p.placeId)
                    ? form.positiveEntities
                    : [...form.positiveEntities, { id: p.placeId, name: p.name, address: p.address }],
                })
              }
            />
            <ul className="space-y-1">
              {form.positiveEntities.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {p.name} — {p.address || copy.taste.addressUnknown}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm({ ...form, positiveEntities: form.positiveEntities.filter((x) => x.id !== p.id) })}
                  >
                    {copy.taste.remove(p.name)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <Button type="submit">{busy ? copy.taste.saving : copy.taste.save}</Button>
        </fieldset>
      </form>
    </Card>
  );
}
