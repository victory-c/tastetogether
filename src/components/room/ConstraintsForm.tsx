'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/copy/en';
import type { Constraints, Occasion, PriceLevel } from '@/lib/api-types';
import { Field, inputClass } from '@/components/ui';

const areas = [
  { label: 'Downtown Berkeley', lat: 37.8716, lon: -122.2727 },
  { label: 'North Berkeley', lat: 37.8796, lon: -122.269 },
  { label: 'Southside / Telegraph', lat: 37.8665, lon: -122.2588 },
  { label: 'Elmwood', lat: 37.858, lon: -122.253 },
  { label: 'Rockridge', lat: 37.8443, lon: -122.2512 },
];
const radii = [
  [1609, '1 mi'],
  [3219, '2 mi'],
  [4828, '3 mi'],
  [8047, '5 mi'],
] as const;

export function ConstraintsForm({
  value,
  onChange,
  disabled = false,
}: {
  value: Constraints;
  onChange: (value: Constraints) => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<Constraints>) => onChange({ ...value, ...patch });
  const area = value.area;
  const time = value.timeWindow ?? { date: '', start: '', end: '' };
  // Keep incomplete input locally so a time window is submitted only when complete.
  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.room.area}>
          <select
            className={inputClass}
            value={area?.label ?? ''}
            onChange={(e) => {
              const selected = areas.find((item) => item.label === e.target.value);
              if (selected)
                update({
                  area: { center: { lat: selected.lat, lon: selected.lon }, label: selected.label, radiusM: area?.radiusM ?? 3219 },
                });
            }}
          >
            <option value="" disabled>
              {copy.room.area}
            </option>
            {area && !areas.some((item) => item.label === area.label) && <option value={area.label}>{area.label}</option>}
            {areas.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.room.radius}>
          <select
            className={inputClass}
            value={area?.radiusM ?? 3219}
            onChange={(e) => {
              if (area) update({ area: { ...area, radiusM: Number(e.target.value) } });
            }}
          >
            {area && !radii.some(([m]) => m === area.radiusM) && <option value={area.radiusM}>{area.radiusM} m</option>}
            {radii.map(([m, label]) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.room.price}>
          <select
            className={inputClass}
            value={value.priceMax ?? ''}
            onChange={(e) => update({ priceMax: e.target.value ? (Number(e.target.value) as PriceLevel) : null })}
          >
            <option value="">{copy.room.noLimit}</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {'$'.repeat(n)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.room.budget} hint={copy.room.budgetHint}>
          <input
            className={inputClass}
            placeholder={copy.room.budgetPlaceholder}
            value={value.budgetNote ?? ''}
            onChange={(e) => update({ budgetNote: e.target.value || null })}
          />
        </Field>
      </div>
      <TimeFields time={time} onChange={(window) => update({ timeWindow: window })} />
      <label className="flex gap-2">
        <input type="checkbox" checked={value.requireOpen} onChange={(e) => update({ requireOpen: e.target.checked })} />
        {copy.room.requireOpen}
      </label>
      <Field label={copy.room.occasion}>
        <select
          className={inputClass}
          value={value.occasion ?? ''}
          onChange={(e) => update({ occasion: (e.target.value || null) as Occasion | null })}
        >
          <option value="">{copy.room.none}</option>
          <option value="friends">{copy.room.friends}</option>
          <option value="date">{copy.room.dateOccasion}</option>
          <option value="business">{copy.room.business}</option>
        </select>
      </Field>
      <fieldset>
        <legend className="font-medium">{copy.room.decision}</legend>
        <div className="flex flex-wrap gap-4">
          {(['three', 'pick'] as const).map((mode) => (
            <label key={mode} className="flex gap-2">
              <input
                type="radio"
                name="decisionMode"
                checked={value.decisionMode === mode}
                onChange={() => update({ decisionMode: mode })}
              />
              {mode === 'three' ? copy.labels.showThree : copy.labels.pickOne}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex gap-2">
        <input type="checkbox" checked={value.excludeVisited} onChange={(e) => update({ excludeVisited: e.target.checked })} />
        {copy.labels.excludeVisited}
      </label>
    </fieldset>
  );
}

function TimeFields({
  time,
  onChange,
}: {
  time: { date: string; start: string; end: string };
  onChange: (value: Constraints['timeWindow']) => void;
}) {
  const [draft, setDraft] = useState(time);
  useEffect(() => {
    if (time.date || time.start || time.end) setDraft(time);
  }, [time.date, time.start, time.end]);
  const change = (key: keyof typeof draft, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onChange(next.date && next.start && next.end ? next : null);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(['date', 'start', 'end'] as const).map((key) => (
        <Field key={key} label={copy.room[key]} hint={key === 'date' ? copy.room.timeHint : undefined}>
          <input
            className={inputClass}
            type={key === 'date' ? 'date' : 'time'}
            value={draft[key]}
            onChange={(e) => change(key, e.target.value)}
          />
        </Field>
      ))}
    </div>
  );
}
