"use client";

import { useState, type ReactNode } from "react";
import { BoardTile } from "@/components/arena/board-tile";
import {
  Celebration,
  type CelebrationData,
} from "@/components/arena/celebration";
import { CountUp } from "@/components/arena/count-up";
import { FixtureRow } from "@/components/arena/fixture-row";
import { HotCard, HotRow, type HotPlayer } from "@/components/arena/hot";
import {
  ClosedTag,
  MarketRow,
  MarketTable,
  MarketTableRow,
  OutlineAction,
  OwnedTag,
  PrimaryAction,
  ReasonAction,
  type RowPlayer,
} from "@/components/arena/market-row";
import { Modal, Sheet } from "@/components/arena/overlay";
import {
  BenchCard,
  CaptainBar,
  Pitch,
  PlayerToken,
  ROW_SCALE,
  SwapLabel,
  type TokenPlayer,
} from "@/components/arena/pitch";
import { PosBadge } from "@/components/arena/pos-badge";
import { SavePill, useSaveState } from "@/components/arena/save-pill";
import { PulseDot, SlantTag } from "@/components/arena/slant-tag";
import { Ticker } from "@/components/arena/ticker";
import { toast } from "@/components/arena/toast";
import { transferBoard } from "@/components/arena/transfer-chips";
import { TransferChips } from "@/components/arena/transfer-chips-view";

const IMG = (id: number) => `/img/players/${id}.webp`;
const LOGO = (id: number) => `/img/clubs/${id}.webp`;

const kane: TokenPlayer = {
  lastName: "Kane",
  image: IMG(108579),
  clubLogo: LOGO(2672),
  posLabel: "ST",
};
const musiala: TokenPlayer = {
  lastName: "Musiala",
  image: IMG(1010231),
  clubLogo: LOGO(2672),
  posLabel: "MF",
};
const neuer: TokenPlayer = {
  lastName: "Neuer",
  image: IMG(8959),
  clubLogo: LOGO(2672),
  posLabel: "TW",
};
const sippel: TokenPlayer = {
  lastName: "Sippel",
  image: IMG(8772),
  clubLogo: LOGO(2527),
  posLabel: "TW",
};
const noPhoto: TokenPlayer = {
  lastName: "Unbekannt",
  clubLogo: LOGO(2530),
  posLabel: "ABW",
};

const hot: HotPlayer = {
  id: 1,
  lastName: "Díaz",
  image: IMG(883537),
  clubLogo: LOGO(2672),
  club: "Bayern",
  posLabel: "MF",
  price: 16,
  delta: 0.5,
};
const row: RowPlayer = {
  id: 883537,
  name: "Luis Díaz",
  image: IMG(883537),
  club: "Bayern",
  clubLogo: LOGO(2672),
  posLabel: "MF",
  price: 16,
  points: 41,
  form: 10.1,
  delta: 0.5,
};
const rowDown: RowPlayer = {
  ...row,
  id: 1010231,
  name: "Jamal Musiala",
  image: IMG(1010231),
  price: 19.2,
  delta: -0.3,
  form: -1,
};

function Panel({ theme }: Readonly<{ theme: "dark" | "light" }>) {
  const [cash, setCash] = useState(4.6);
  const [anim, setAnim] = useState(0);
  const board = transferBoard(
    { unlimited: false, freeLeft: 0, nextCost: 5 },
    [
      { matchday: 5, free: true },
      { matchday: 5, free: true },
      { matchday: 5, free: false },
    ],
    { open: true, matchday: 5 },
  );
  return (
    <div data-theme={theme} className="min-w-0 flex-1 bg-bg pb-10 text-text">
      <header className="hero-bg px-[18px] pt-5 pb-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SlantTag>Spieltag 05</SlantTag>
          <span className="flex items-center gap-2 text-xs font-bold uppercase">
            <PulseDot /> Fixiert in{" "}
            <b className="font-display text-lg">02:47:18</b>
          </span>
        </div>
        <h1 className="font-display text-[36px] leading-[0.95] font-black uppercase">
          Kreidelinie FC
        </h1>
        <div className="mt-2.5 flex gap-[22px]">
          <BoardTile plainOnMobile label="Platz" value="2" unit="/8" />
          <BoardTile plainOnMobile label="Saison" value="356" unit=" P." />
          <BoardTile plainOnMobile accent label="4. Spieltag" value="+96" />
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_1.25fr] gap-2">
          <BoardTile
            accent
            label="Guthaben"
            value={<CountUp value={cash} decimals={1} flash />}
            unit=" MIO"
          />
          <BoardTile label={`Transfers · ${board.note}`} value="">
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-display text-[28px] leading-[0.95] font-black text-karte-hell">
                {board.big}
                <span className="text-sm"> {board.unit}</span>
              </span>
              <TransferChips
                chips={board.chips}
                animate={anim ? { kind: "drop", key: anim } : null}
              />
            </div>
          </BoardTile>
        </div>
      </header>
      <Ticker
        items={[
          { id: 1, lastName: "Kobel", delta: 0.2 },
          { id: 2, lastName: "Olise", delta: 0.6 },
          { id: 3, lastName: "Musiala", delta: -0.3 },
        ]}
      />
      <div className="space-y-5 px-[18px] pt-4">
        <Demo title="Tags">
          <div className="flex flex-wrap gap-2">
            <SlantTag>hero</SlantTag>
            <SlantTag variant="lampe">lampe</SlantTag>
            <SlantTag variant="nacht">nacht</SlantTag>
            <SlantTag variant="live">Live · läuft</SlantTag>
            <SlantTag variant="off">Fenster zu</SlantTag>
          </div>
        </Demo>
        <Demo title="Positions-Badges">
          <div className="flex gap-3 bg-rasen p-3">
            <PosBadge label="ST" />
            <PosBadge label="MF" state="partner" />
            <PosBadge label="ABW" state="error" errorKey={anim} />
            <PosBadge label="TW" variant="list" />
          </div>
        </Demo>
        <Demo title="Aktionen">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="border-2 border-line px-3 py-2"
              onClick={() => toast("Kane trägt die Binde – Punkte ×2!")}
            >
              Toast
            </button>
            <button
              type="button"
              className="border-2 border-line px-3 py-2"
              onClick={() => toast.error("Speichern hat nicht geklappt.")}
            >
              Fehler-Toast
            </button>
            <button
              type="button"
              className="border-2 border-line px-3 py-2"
              onClick={() => {
                setCash((c) => Math.round((c + 2.3) * 10) / 10);
                setAnim((n) => n + 1);
              }}
            >
              Guthaben +2,3
            </button>
          </div>
        </Demo>
        <Demo title="Spielfeld">
          <Pitch
            label="Startelf, Demo"
            overlay={
              anim ? <SwapLabel key={anim} a="Kane" b="Musiala" /> : null
            }
            rows={[
              [
                <PlayerToken
                  key="k"
                  player={kane}
                  points={16}
                  captain
                  locked={false}
                  selected={false}
                  dimmed={false}
                  sub="Bremen (H)"
                  scale={ROW_SCALE[0]}
                  ariaLabel="Kane"
                  onTap={() => setAnim((n) => n + 1)}
                  anim={anim ? { kind: "swap-l", key: anim } : null}
                  captainStampKey={anim}
                />,
                <PlayerToken
                  key="m"
                  player={musiala}
                  points={-3}
                  captain={false}
                  locked
                  selected={false}
                  dimmed={false}
                  sub="fixiert"
                  scale={ROW_SCALE[0]}
                  ariaLabel="Musiala"
                  onTap={() => {}}
                  lockSnapKey={anim}
                />,
              ],
              [
                <PlayerToken
                  key="x"
                  player={noPhoto}
                  points={5}
                  captain={false}
                  locked={false}
                  selected
                  dimmed={false}
                  posState="partner"
                  sub="Mainz 05 (H)"
                  scale={ROW_SCALE[1]}
                  ariaLabel="Unbekannt"
                  onTap={() => {}}
                />,
                <PlayerToken
                  key="y"
                  player={musiala}
                  points={null}
                  captain={false}
                  locked={false}
                  selected={false}
                  dimmed
                  sub="Mainz 05 (H)"
                  scale={ROW_SCALE[1]}
                  ariaLabel="Musiala"
                  onTap={() => {}}
                />,
              ],
              [],
              [
                <PlayerToken
                  key="n"
                  player={neuer}
                  points={4}
                  captain={false}
                  locked={false}
                  selected={false}
                  dimmed={false}
                  sub="Stuttgart (A)"
                  scale={ROW_SCALE[3]}
                  ariaLabel="Neuer"
                  onTap={() => {}}
                />,
              ],
            ]}
          />
        </Demo>
        <Demo title="Kapitän und Bank">
          <CaptainBar
            name="Harry Kane"
            image={kane.image}
            multiplier={2}
            popKey={anim}
          />
          <div className="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-2">
            <BenchCard
              slot="TW"
              player={sippel}
              locked={false}
              selected={false}
              dimmed={false}
              ariaLabel="Sippel"
              onTap={() => {}}
            />
            <BenchCard
              slot="B1"
              player={noPhoto}
              locked
              selected={false}
              dimmed={false}
              ariaLabel="B1"
              onTap={() => {}}
            />
            <BenchCard
              slot="B2"
              player={musiala}
              locked={false}
              selected
              dimmed={false}
              posState="partner"
              ariaLabel="B2"
              onTap={() => {}}
            />
            <BenchCard
              slot="B3"
              player={kane}
              locked={false}
              selected={false}
              dimmed
              ariaLabel="B3"
              onTap={() => {}}
            />
          </div>
        </Demo>
        <Demo title="Heiß gerade">
          <div className="flex gap-2.5">
            <HotCard player={hot} onClick={() => toast("Holen: Díaz")} />
            <HotCard
              player={{ ...hot, image: undefined, lastName: "Kleindienst" }}
              onClick={() => {}}
            />
          </div>
          <div className="mt-2 space-y-1.5">
            <HotRow player={hot} onClick={() => {}} />
          </div>
        </Demo>
        <Demo title="Marktliste">
          <ul>
            <MarketRow p={row} action={<PrimaryAction>Holen</PrimaryAction>} />
            <MarketRow p={rowDown} action={<OwnedTag />} />
            <MarketRow
              p={row}
              picked
              action={<OutlineAction>Raus</OutlineAction>}
            />
            <MarketRow
              p={rowDown}
              action={<ReasonAction>schon 5 von Bayern</ReasonAction>}
            />
            <MarketRow p={row} action={<ClosedTag />} />
          </ul>
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[640px]">
              <MarketTable count={2}>
                <MarketTableRow
                  p={row}
                  action={<PrimaryAction>Holen</PrimaryAction>}
                />
                <MarketTableRow p={rowDown} action={<OwnedTag />} />
              </MarketTable>
            </div>
          </div>
        </Demo>
        <Demo title="Spiele">
          <ul>
            <FixtureRow
              home="Frankfurt"
              away="Mainz 05"
              homeLogo={LOGO(2674)}
              awayLogo={LOGO(2556)}
              state={{ kind: "done", score: "2:0" }}
            />
            <FixtureRow
              home="Bremen"
              away="Bayern"
              homeLogo={LOGO(2534)}
              awayLogo={LOGO(2672)}
              state={{ kind: "live", score: "0:2", label: "läuft" }}
            />
            <FixtureRow
              home="Stuttgart"
              away="Dortmund"
              homeLogo={LOGO(2677)}
              awayLogo={LOGO(2673)}
              state={{ kind: "open", kickoff: "Sa. 18:30" }}
            />
          </ul>
        </Demo>
      </div>
    </div>
  );
}

function Demo({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section>
      <h2 className="mb-2 font-display text-[26px] font-black uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ArenaDemo() {
  const save = useSaveState();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  return (
    <main className="min-h-dvh">
      <div className="flex flex-wrap gap-2 bg-nacht p-3 text-kreide">
        <button
          type="button"
          className="border border-kreide/40 px-3 py-2"
          onClick={() => {
            save.begin();
            setTimeout(() => save.done(true), 650);
          }}
        >
          Speichern-Pille
        </button>
        <button
          type="button"
          className="border border-kreide/40 px-3 py-2"
          onClick={() =>
            setCelebration({
              kind: "deal",
              title: "Deal!",
              name: "Luis Díaz",
              sub: "Dein neuer Mittelfeldspieler · 16,0 Mio · freier Transfer",
              image: IMG(883537),
              out: { name: "Musiala", image: IMG(1010231) },
            })
          }
        >
          Deal!
        </button>
        <button
          type="button"
          className="border border-kreide/40 px-3 py-2"
          onClick={() =>
            setCelebration({
              kind: "squad",
              title: "Kader steht!",
              name: "Kreidelinie FC",
              sub: "15 Spieler · 84,6 Mio investiert",
              image: IMG(108579),
              faces: Array.from(
                { length: 15 },
                (_, i) =>
                  [IMG(108579), IMG(1010231), IMG(8959), undefined][i % 4],
              ),
            })
          }
        >
          Kader steht!
        </button>
        <button
          type="button"
          className="border border-kreide/40 px-3 py-2"
          onClick={() => setSheet(true)}
        >
          Sheet
        </button>
        <button
          type="button"
          className="border border-kreide/40 px-3 py-2"
          onClick={() => setModal(true)}
        >
          Modal
        </button>
      </div>
      <div className="flex flex-col lg:flex-row">
        <Panel theme="dark" />
        <Panel theme="light" />
      </div>
      <SavePill state={save.state} />
      {sheet ? (
        <Sheet labelledBy="demo-sheet" onClose={() => setSheet(false)}>
          <p
            id="demo-sheet"
            className="text-[11px] font-bold tracking-[0.14em] text-lampe uppercase"
          >
            Sheet
          </p>
          <p className="mt-1 font-display text-3xl font-black uppercase">
            Esc schließt
          </p>
          <button
            type="button"
            onClick={() => setSheet(false)}
            className="mt-3 h-12 w-full border-2 border-white/40 font-display text-xl font-black uppercase"
          >
            Abbrechen
          </button>
        </Sheet>
      ) : null}
      {modal ? (
        <Modal labelledBy="demo-modal" onClose={() => setModal(false)}>
          <p
            id="demo-modal"
            className="text-[11px] font-bold tracking-[0.14em] text-lampe uppercase"
          >
            Deal bestätigen
          </p>
          <button
            type="button"
            onClick={() => setModal(false)}
            className="mt-3 h-12 w-full bg-lampe font-display text-2xl font-black text-nacht uppercase"
          >
            Deal!
          </button>
        </Modal>
      ) : null}
      {celebration ? (
        <Celebration data={celebration} onClose={() => setCelebration(null)} />
      ) : null}
    </main>
  );
}
