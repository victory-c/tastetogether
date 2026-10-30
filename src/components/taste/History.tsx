'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Field, inputClass, Notice } from '@/components/ui';
import { PlacePicker } from '@/components/taste/PlacePicker';
import { copy } from '@/copy/en';
import { api, ApiClientError } from '@/lib/api-client';
import type { MemoriesResponse, MemoryDTO, MemoryInput, MemoryStatus, Rating } from '@/lib/api-types';

const empty: MemoryInput = {
  placeId: null,
  name: '',
  address: null,
  status: 'visited',
  rating: null,
  revisitIntent: null,
  visitDate: null,
  visitCount: null,
};
const statuses: MemoryStatus[] = ['visited', 'want_to_try', 'dismissed'];
const ratings: Rating[] = ['liked', 'neutral', 'disliked'];

export function History({ readOnly }: { readOnly: boolean }) {
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MemoryDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [form, setForm] = useState<MemoryInput>(empty);
  const [query, setQuery] = useState('');
  const [unresolved, setUnresolved] = useState(false);
  const refresh = useCallback(async () => {
    const data = await api<MemoriesResponse>('/api/memories');
    setMemories(data.memories);
  }, []);
  useEffect(() => {
    let active = true;
    api<MemoriesResponse>('/api/memories')
      .then((data) => {
        if (active) setMemories(data.memories);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function reset() {
    setAdding(false);
    setEditing(null);
    setLinking(null);
    setQuery('');
    setUnresolved(false);
    setForm(empty);
  }
  async function change(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method, body });
      await refresh();
      reset();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : copy.errors.internal);
    } finally {
      setBusy(false);
    }
  }
  function edit(memory: MemoryDTO) {
    setAdding(false);
    setLinking(null);
    setEditing(memory);
    setUnresolved(false);
    setQuery('');
    setForm({
      placeId: memory.placeId,
      name: memory.name,
      address: memory.address,
      status: memory.status,
      rating: memory.rating,
      revisitIntent: memory.revisitIntent,
      visitDate: memory.visitDate,
      visitCount: memory.visitCount,
    });
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{copy.taste.history}</h2>
        <p className="mt-1 text-sm text-stone-600">{copy.taste.historyHint}</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <p role="status">{copy.taste.loading}</p>}
      {!loading && !memories.length && <p>{copy.taste.empty}</p>}
      {statuses.map((status) => {
        const entries = memories.filter((m) => m.status === status);
        return (
          entries.length > 0 && (
            <div key={status} className="space-y-2">
              <h3 className="font-semibold">{copy.taste[status]}</h3>
              {entries.map((m) => (
                <Card key={m.id}>
                  <div className="space-y-2">
                    <h4 className="font-medium">{m.name}</h4>
                    <p className="text-sm text-stone-600">{m.address || copy.taste.addressUnknown}</p>
                    {!m.placeId && <Badge tone="warn">{copy.taste.unlinked}</Badge>}
                    <p className="text-sm">
                      {copy.taste.status}: {copy.taste[m.status]}
                    </p>
                    <p className="text-sm">{copy.taste.ratingValue(m.rating ? copy.taste[m.rating] : copy.taste.unknown)}</p>
                    <p className="text-sm">
                      {copy.taste.revisitValue(
                        m.revisitIntent === null ? copy.taste.unknown : m.revisitIntent ? copy.taste.yes : copy.taste.no,
                      )}
                    </p>
                    {m.visitDate && <p className="text-sm">{copy.taste.visitDateValue(m.visitDate)}</p>}
                    {m.visitCount !== null && <p className="text-sm">{copy.taste.visitCountValue(m.visitCount)}</p>}
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => edit(m)}>
                          {copy.taste.edit}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(copy.taste.confirmDelete))
                              void change(`/api/memories/${encodeURIComponent(m.id)}`, 'DELETE');
                          }}
                        >
                          {copy.taste.delete}
                        </Button>
                        {!m.placeId && (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              reset();
                              setLinking(m.id);
                            }}
                          >
                            {copy.taste.link}
                          </Button>
                        )}
                      </div>
                    )}
                    {linking === m.id && (
                      <div className="space-y-2">
                        <p className="text-sm">{copy.taste.pickHint}</p>
                        <PlacePicker
                          query={query}
                          onQueryChange={setQuery}
                          onPick={(p) =>
                            void change(`/api/memories/${encodeURIComponent(m.id)}`, 'PATCH', {
                              placeId: p.placeId,
                              name: p.name,
                              address: p.address,
                            })
                          }
                        />
                        <Button type="button" variant="ghost" onClick={reset}>
                          {copy.taste.cancel}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        );
      })}
      {!readOnly && !adding && !editing && (
        <Button
          onClick={() => {
            reset();
            setAdding(true);
          }}
        >
          {copy.taste.add}
        </Button>
      )}
      {(adding || editing) && (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void change(editing ? `/api/memories/${encodeURIComponent(editing.id)}` : '/api/memories', editing ? 'PATCH' : 'POST', form);
            }}
          >
            <h3 className="font-semibold">{editing ? copy.taste.edit : copy.taste.add}</h3>
            {adding && (
              <>
                <PlacePicker
                  query={query}
                  onQueryChange={setQuery}
                  onPick={(p) => {
                    setForm({ ...form, placeId: p.placeId, name: p.name, address: p.address });
                    setUnresolved(false);
                  }}
                />
                {form.placeId && (
                  <p className="text-sm">
                    {copy.taste.chosen}: {form.name} — {form.address || copy.taste.addressUnknown}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setUnresolved(true);
                    setForm({ ...form, placeId: null, name: query, address: null });
                  }}
                >
                  {copy.taste.cantFind}
                </Button>
                {unresolved && (
                  <>
                    <Field label={copy.taste.unresolvedName}>
                      <input
                        className={inputClass}
                        required
                        maxLength={200}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </Field>
                    <Field label={copy.taste.optionalAddress}>
                      <input
                        className={inputClass}
                        maxLength={300}
                        value={form.address ?? ''}
                        onChange={(e) => setForm({ ...form, address: e.target.value || null })}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {editing && (
              <p>
                {form.name} — {form.address || copy.taste.addressUnknown}
              </p>
            )}
            <Field label={copy.taste.status}>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MemoryStatus })}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {copy.taste[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.taste.rating}>
              <select
                className={inputClass}
                value={form.rating ?? ''}
                onChange={(e) => setForm({ ...form, rating: e.target.value ? (e.target.value as Rating) : null })}
              >
                <option value="">{copy.taste.unknown}</option>
                {ratings.map((r) => (
                  <option key={r} value={r}>
                    {copy.taste[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={copy.taste.revisit}>
              <select
                className={inputClass}
                value={form.revisitIntent === null || form.revisitIntent === undefined ? '' : String(form.revisitIntent)}
                onChange={(e) => setForm({ ...form, revisitIntent: e.target.value === '' ? null : e.target.value === 'true' })}
              >
                <option value="">{copy.taste.unknown}</option>
                <option value="true">{copy.taste.yes}</option>
                <option value="false">{copy.taste.no}</option>
              </select>
            </Field>
            <Field label={copy.taste.visitDate}>
              <input
                type="date"
                className={inputClass}
                value={form.visitDate ?? ''}
                onChange={(e) => setForm({ ...form, visitDate: e.target.value || null })}
              />
            </Field>
            <Field label={copy.taste.visitCount}>
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                className={inputClass}
                value={form.visitCount ?? ''}
                onChange={(e) => setForm({ ...form, visitCount: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !form.name.trim() || (adding && !form.placeId && !unresolved)}>
                {busy ? copy.taste.saving : editing ? copy.taste.editSave : copy.taste.addSave}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
                {copy.taste.cancel}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </section>
  );
}
