"use client";

import clsx from "clsx";
import { Loader2, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { KIND_LABEL } from "@/lib/client/format";
import type { Interest } from "@/lib/taste/types";

export function TasteSearch({
  side,
  onPick,
  disabled,
  placeholder,
}: {
  side: "a" | "b";
  onPick: (i: Interest) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setResults(json.results ?? []);
        setError(null);
        setActive(0);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message || "Search is unavailable.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = q.trim().length >= 2 ? results : [];

  const choose = (i: Interest) => {
    onPick(i);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div
        className={clsx(
          "flex items-center gap-2 rounded-2xl border bg-paper px-3.5 py-3 transition",
          side === "a" ? "focus-within:border-a focus-within:ring-4 focus-within:ring-a/15" : "focus-within:border-b focus-within:ring-4 focus-within:ring-b/15",
          "border-line",
          disabled && "opacity-50",
        )}
      >
        <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <input
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => shown.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || shown.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % shown.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + shown.length) % shown.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = shown[active];
              if (r) choose(r);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={placeholder}
        />
        {loading && q.trim().length >= 2 && <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" aria-label="Searching" />}
      </div>
      {error && <p className="mt-1.5 text-xs text-a-deep">{error}</p>}
      {open && q.trim().length >= 2 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-auto rounded-2xl border border-line bg-paper p-1.5 shadow-lift"
        >
          {shown.length === 0 && !loading && (
            <li className="px-3 py-3 text-sm text-ink-soft">No matches in Qloo yet. Try an artist, film, show or book.</li>
          )}
          {shown.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              className={clsx(
                "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2",
                i === active && (side === "a" ? "bg-a-soft/70" : "bg-b-soft/70"),
              )}
            >
              <Thumb src={r.image} alt="" kind={r.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{r.name}</p>
                <p className="text-xs text-ink-soft">
                  {KIND_LABEL[r.kind]}
                  {r.year ? ` · ${r.year}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Thumb({ src, alt, kind, size = 40 }: { src?: string; alt: string; kind: Interest["kind"]; size?: number }) {
  const round = kind === "artist" ? "rounded-full" : "rounded-lg";
  if (!src) {
    return (
      <div
        className={clsx("grid shrink-0 place-items-center bg-line text-xs font-semibold text-ink-soft", round)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {KIND_LABEL[kind].slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} loading="lazy" className={clsx("shrink-0 object-cover", round)} style={{ width: size, height: size }} />
  );
}
