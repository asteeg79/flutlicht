import { PlayerPhoto } from "@/components/player-photo";
import { mioNumber } from "@/lib/format";

export interface HotPlayer {
  id: number;
  lastName: string;
  image?: string;
  clubLogo: string;
  club: string;
  posLabel: string;
  price: number;
  delta: number;
}

const badge = "bg-lampe font-display font-black text-nacht whitespace-nowrap";

/** „Heiß gerade“ mobil: Karte 118×150, Foto 64 px (nie größer, Quelle 128 px). */
export function HotCard({
  player,
  onClick,
}: {
  player: HotPlayer;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.lastName} holen, ${player.posLabel}, ${mioNumber(player.price)} Mio, plus ${mioNumber(player.delta)}`}
      className="cut-corner relative flex h-[150px] w-[118px] shrink-0 flex-col items-center gap-[7px] bg-hot-bg bg-[radial-gradient(80%_55%_at_50%_0%,rgb(255_213_74/0.28),transparent_75%)] px-2 pt-3 pb-2.5 text-white"
    >
      <span
        className={`absolute top-[7px] left-[7px] px-1.5 py-px text-[13px] ${badge}`}
      >
        ▲ {mioNumber(player.delta)}
      </span>
      <span className="relative mt-1.5 h-16 w-16">
        <PlayerPhoto
          src={player.image}
          className="h-16 w-16 border-2 border-lampe"
        />
        <img
          src={player.clubLogo}
          alt=""
          className="absolute -right-1 -bottom-0.5 h-5 w-5 rounded-full bg-white p-0.5"
        />
      </span>
      <span className="max-w-full truncate font-display text-[19px] leading-[0.95] font-black uppercase">
        {player.lastName}
      </span>
      <span className="text-[11px] font-semibold whitespace-nowrap opacity-85">
        {player.posLabel} · {mioNumber(player.price)} Mio
      </span>
    </button>
  );
}

/** „Heiß gerade“ auf dem Desktop: Zeile in der Seitenspalte. */
export function HotRow({
  player,
  onClick,
}: {
  player: HotPlayer;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 bg-hot-bg px-2.5 py-2 text-left text-white [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]"
    >
      <PlayerPhoto
        src={player.image}
        className="h-11 w-11 border-2 border-lampe"
      />
      <span className="min-w-0">
        <span className="block truncate font-display text-[19px] leading-none font-black uppercase">
          {player.lastName}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold opacity-80">
          {player.posLabel} · {player.club} · {mioNumber(player.price)} Mio
        </span>
      </span>
      <span className={`px-[7px] py-0.5 text-[15px] ${badge}`}>
        ▲ {mioNumber(player.delta)}
      </span>
    </button>
  );
}
