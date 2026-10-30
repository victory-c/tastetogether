"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { KIND_LABEL } from "@/lib/client/format";
import { SAMPLE_DUOS } from "@/lib/taste/samples";
import type { Interest } from "@/lib/taste/types";

const DUO = SAMPLE_DUOS[0]!;

function Bubble({ i, side, idx }: { i: Interest & { image?: string }; side: "a" | "b"; idx: number }) {
  // Two columns of chips that hug the outer edge of each circle and leave the centre for the plate card.
  const rows = ["14%", "32%", "64%", "82%"];
  const inset = ["8%", "0%", "0%", "8%"];
  const pos = side === "a" ? { left: inset[idx % 4], top: rows[idx % 4] } : { right: inset[idx % 4], top: rows[idx % 4] };
  return (
    <motion.div
      className="absolute flex items-center gap-2 rounded-full bg-paper/95 py-1 pr-3 pl-1 shadow-card ring-1 ring-line"
      style={pos}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + idx * 0.15 + (side === "b" ? 0.08 : 0), type: "spring", stiffness: 200, damping: 18 }}
    >
      <span className="animate-float flex items-center gap-2" style={{ animationDelay: `${idx * 0.7}s` }}>
        {i.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.image} alt="" className={`size-8 object-cover ${i.kind === "artist" ? "rounded-full" : "rounded-md"}`} />
        ) : (
          <span className="skeleton size-8 rounded-full" />
        )}
        <span className="text-left leading-tight">
          <span className="block max-w-[7.5rem] truncate text-[13px] font-semibold">{i.name}</span>
          <span className="block text-[10px] text-ink-faint">{KIND_LABEL[i.kind]}</span>
        </span>
      </span>
    </motion.div>
  );
}

export function HeroOrbit() {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...DUO.a.interests, ...DUO.b.interests].map((i) => i.id).join(",");
    fetch(`/api/entities?ids=${ids}`)
      .then((r) => r.json())
      .then((j) => setImages(j.images ?? {}))
      .catch(() => {});
  }, []);

  const withImg = (xs: Interest[]) => xs.map((i) => ({ ...i, image: images[i.id] }));

  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px]">
      <motion.div
        className="absolute top-[8%] left-[2%] aspect-square w-[60%] rounded-full bg-a/12 ring-1 ring-a/25"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 60, damping: 14 }}
      />
      <motion.div
        className="absolute top-[8%] right-[2%] aspect-square w-[60%] rounded-full bg-b/12 ring-1 ring-b/25"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 60, damping: 14 }}
      />
      <p className="absolute top-0 left-[18%] font-display text-lg font-semibold text-a-deep italic">{DUO.a.name}</p>
      <p className="absolute top-0 right-[18%] font-display text-lg font-semibold text-b-deep italic">{DUO.b.name}</p>

      {withImg(DUO.a.interests).map((i, idx) => (
        <Bubble key={i.id} i={i} side="a" idx={idx} />
      ))}
      {withImg(DUO.b.interests).map((i, idx) => (
        <Bubble key={i.id} i={i} side="b" idx={idx} />
      ))}

      <motion.div
        className="absolute top-[40%] left-1/2 w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-paper p-3 text-center shadow-lift ring-1 ring-line"
        initial={{ opacity: 0, y: 16, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.1, type: "spring", stiffness: 160, damping: 16 }}
      >
        <span className="text-3xl" aria-hidden>
          🍽️
        </span>
        <p className="mt-1 font-display text-sm leading-tight font-semibold">Where your tastes meet</p>
        <p className="mt-1 text-[10px] leading-tight text-ink-soft">Scored live for both of you by Qloo</p>
      </motion.div>
    </div>
  );
}
