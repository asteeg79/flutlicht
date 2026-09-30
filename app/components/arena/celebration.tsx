"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { PlayerPhoto } from "@/components/player-photo";

export interface CelebrationData {
  kind: "deal" | "squad";
  title: string;
  name: string;
  sub: string;
  image?: string;
  /** Deal: abgegebener Spieler, fährt durchgestrichen links raus. */
  out?: { name: string; image?: string };
  /** Kader: die 15 Gesichter, nacheinander. */
  faces?: (string | undefined)[];
}

const SHARD_COLORS = ["bg-lampe", "bg-white", "bg-up", "bg-lampe"];
const SHARDS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = 120 + (i % 3) * 40;
  return {
    style: {
      "--dx": `${Math.round(Math.cos(a) * d)}px`,
      "--dy": `${Math.round(Math.sin(a) * d)}px`,
      "--r": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
      width: 10 + (i % 3) * 6,
      animationDelay: `${250 + (i % 4) * 40}ms`,
    } as CSSProperties,
    color: SHARD_COLORS[i % 4],
  };
});

/**
 * Vollbild-Feier (Arena 8): zwei schwenkende Flutlicht-Kegel, Ringe, Konfetti, Titel
 * in 96 px. Nach 3,4 s oder mit Tipp/Klick/Esc vorbei; auf dem Desktop bleibt die
 * Seitenleiste sichtbar.
 */
export function Celebration({
  data,
  onClose,
}: {
  data: CelebrationData;
  onClose: () => void;
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const timer = setTimeout(() => close.current(), 3400);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${data.title} ${data.name}`}
      data-testid="celebration"
      onClick={onClose}
      className="arena-anim fixed inset-0 z-[60] flex animate-[arena-fade_.2s_both] cursor-pointer flex-col items-center justify-center overflow-hidden bg-nacht/95 bg-[radial-gradient(60%_45%_at_50%_42%,rgb(255_213_74/0.22),transparent_70%)] text-white lg:left-60"
    >
      <div className="absolute -top-[60px] left-[4%] h-[760px] w-[150px] origin-top animate-[arena-beam-l_3s_ease-in-out_infinite] bg-[linear-gradient(180deg,rgb(255_213_74/0.5),rgb(255_213_74/0)_75%)] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
      <div className="absolute -top-[60px] right-[4%] h-[760px] w-[150px] origin-top animate-[arena-beam-r_3s_ease-in-out_infinite] bg-[linear-gradient(180deg,rgb(255_244_214/0.4),rgb(255_244_214/0)_75%)] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
      {data.out ? (
        <div className="absolute top-[120px] left-7 flex animate-[arena-out_.9s_.5s_ease-in_both] items-center gap-2 opacity-80">
          <PlayerPhoto src={data.out.image} className="h-10 w-10 grayscale" />
          <span className="font-display text-lg font-black uppercase line-through">
            {data.out.name}
          </span>
        </div>
      ) : null}
      <div className="relative h-32 w-32">
        <span className="absolute top-1/2 left-1/2 h-32 w-32 animate-[arena-burst_1s_.2s_ease-out_both] rounded-full border-4 border-lampe" />
        <span className="absolute top-1/2 left-1/2 h-32 w-32 animate-[arena-burst_1.1s_.45s_ease-out_both] rounded-full border-[3px] border-white" />
        {SHARDS.map((s, i) => (
          <span
            key={i}
            style={s.style}
            className={`absolute top-[60px] left-[60px] h-1.5 animate-[arena-shard_1s_cubic-bezier(.1,.7,.3,1)_both] ${s.color}`}
          />
        ))}
        <span className="relative block h-32 w-32 animate-[arena-zoom_.7s_.1s_cubic-bezier(.2,1.3,.4,1)_both] rounded-full shadow-[0_0_50px_rgb(255_213_74/0.7)]">
          <PlayerPhoto
            src={data.image}
            className="h-32 w-32 border-4 border-lampe"
          />
        </span>
      </div>
      <p className="relative mt-[26px] animate-[arena-slam_.6s_.35s_cubic-bezier(.2,1.2,.4,1)_both] font-display text-[96px] leading-[0.85] font-black text-lampe uppercase [text-shadow:0_0_40px_rgb(255_213_74/0.6)]">
        {data.title}
      </p>
      <p className="relative mt-2.5 animate-[arena-rise_.4s_.7s_ease-out_both] text-center font-display text-[32px] leading-none font-black uppercase">
        {data.name}
      </p>
      <p className="relative mx-6 mt-1.5 animate-[arena-rise_.4s_.8s_ease-out_both] text-center text-[13px] font-semibold opacity-85">
        {data.sub}
      </p>
      {data.faces ? (
        <div className="relative mt-4 flex max-w-[300px] flex-wrap justify-center gap-1">
          {data.faces.map((img, i) => (
            <span
              key={i}
              style={{ animationDelay: `${700 + i * 60}ms` }}
              className="animate-[arena-pop_.4s_ease-out_both]"
            >
              <PlayerPhoto
                src={img}
                className="h-[34px] w-[34px] border-2 border-lampe"
              />
            </span>
          ))}
        </div>
      ) : null}
      <p className="relative mt-[26px] animate-[arena-fade_.3s_1.2s_both] font-display text-sm font-extrabold tracking-[0.14em] uppercase opacity-60">
        Tippen zum Weitermachen
      </p>
    </div>
  );
}
