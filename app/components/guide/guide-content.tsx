// Texte der Anleitung. Alle Regelzahlen kommen aus core bzw. season.json, damit
// die Anleitung nach einer Kalibrierung weiter stimmt.
import {
  FORMATIONS,
  MARKET,
  RULES,
  SCORING,
  SELECTABLE_FORMATIONS,
  type Position,
} from "@fm/core";
import type { ReactNode } from "react";
import { signedInt } from "@/lib/format";
import { strikerExample, type GuideChapterId } from "@/lib/guide";

export interface GuideFacts {
  startBudget: number;
  firstScoredMatchday: number;
}

const de = (n: number) => n.toLocaleString("de-DE");
const POS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POS_LABEL = ["TW", "ABW", "MF", "ST"];

function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[15px] leading-relaxed">{children}</p>;
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-display text-[26px] leading-[1.05] font-black text-lampe uppercase">
      {children}
    </p>
  );
}

function List({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-3 flex list-none flex-col gap-2.5 text-[15px] leading-relaxed">
      {children}
    </ul>
  );
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:top-[0.55em] before:left-0 before:h-2 before:w-2 before:bg-lampe">
      {children}
    </li>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 border-l-4 border-lampe bg-white/[0.06] px-3.5 py-2.5 text-[15px] leading-relaxed">
      {children}
    </p>
  );
}

function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-white/20 text-left text-[11px] font-bold tracking-[0.08em] text-kreide-matt uppercase">
            {head.map((h, i) => (
              <th key={i} className="px-1.5 py-1.5 first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-white/10">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className="px-1.5 py-1.5 align-top first:pl-0 first:font-semibold first:normal-nums"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Punkte je Position; 0 wird als „–“ gezeigt. */
function perPos(values: Record<Position, number>) {
  return POS.map((p) => (values[p] === 0 ? "–" : signedInt(values[p])));
}

function Idee({ facts }: { facts: GuideFacts }) {
  return (
    <>
      <Lead>Du bist Manager. Die ganze Bundesliga ist dein Markt.</Lead>
      <P>
        Jeder in der Runde bekommt dasselbe Budget von{" "}
        <b>{de(facts.startBudget)} Mio.</b> und baut daraus einen Kader aus{" "}
        {RULES.squadSize} Bundesliga-Spielern. Jedes Wochenende schickst du elf
        davon aufs Feld, und für alles, was sie im echten Spiel leisten, gibt es
        Punkte. Wer am Ende der Saison die meisten hat, gewinnt.
      </P>
      <List>
        <Li>
          <b>Echte Daten statt Bauchgefühl.</b> Kein Redakteur vergibt Noten.
          Die Punkte kommen aus der Spielernote und dem, was auf dem Platz
          passiert: Tore, Vorlagen, zu null, Karten. Ein Innenverteidiger, der
          90 Minuten alles wegräumt, kann mehr bringen als der Stürmer, der
          einmal abstaubt.
        </Li>
        <Li>
          <b>Jeder darf jeden haben.</b> Keine Auslosung, kein Wettbieten. Wenn
          alle den Top-Stürmer kaufen, entscheidet der Rest: dein Kapitän, deine
          Bank, dein Riecher für den Spieler, den noch keiner auf dem Zettel
          hat.
        </Li>
        <Li>
          <b>Der Markt lebt.</b> Nach jedem Spieltag ändern sich die Preise mit
          der Leistung. Wer früh auf den Richtigen setzt, hat später mehr Geld
          für den nächsten Coup.
        </Li>
        <Li>
          <b>Jedes Wochenende eine neue Chance.</b> Neben der Gesamttabelle gibt
          es jeden Spieltag einen Sieger. Auch wer hinten liegt, kann am
          Samstagabend ganz oben stehen.
        </Li>
        <Li>
          <b>Die Konferenz bekommt einen neuen Sinn.</b> Plötzlich ist das 0:0
          zwischen zwei Abstiegskandidaten spannend, weil dein Torwart
          drinsteht.
        </Li>
      </List>
      <Tip>
        Kein Einsatz, kein Pokal, keine Werbung. Es geht um das Einzige, was
        zählt: die Ehre, der beste Manager der Runde zu sein.
      </Tip>
    </>
  );
}

function Start({ facts }: { facts: GuideFacts }) {
  const c = RULES.squadComposition;
  return (
    <>
      <Lead>In fünf Minuten startklar.</Lead>
      <ol className="mb-3 flex list-none flex-col gap-3 text-[15px] leading-relaxed">
        {[
          <>
            <b>Kader bauen.</b> Kauf auf dem Markt {RULES.squadSize} Spieler:{" "}
            {c.GK} Torhüter, {c.DEF} Abwehr, {c.MID} Mittelfeld, {c.FWD} Sturm.
            Höchstens {RULES.maxPerClub} pro Verein, Budget{" "}
            {de(facts.startBudget)} Mio. Bis zu deinem ersten gewerteten
            Spieltag baust du so oft um, wie du willst, ohne Abzug.
          </>,
          <>
            <b>Aufstellung wählen.</b> 11 Starter, dazu die Bank mit
            Ersatztorwart und drei Feldspielern in fester Reihenfolge.
          </>,
          <>
            <b>Kapitän bestimmen.</b> Seine Punkte zählen doppelt.
          </>,
          <>
            <b>Aufs Handy holen.</b> Unter Optionen → „Flutlicht als App“ legst
            du Flutlicht auf den Home-Bildschirm. Auf dem iPhone kommen nur so
            Push-Nachrichten an, und die erinnern dich, bevor der Spieltag
            losgeht.
          </>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-lampe font-display text-lg font-black text-nacht">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <P>
        Deine Aufstellung gilt weiter, bis du sie änderst. Schaust du mal ein
        Wochenende nicht rein, spielt dein Team trotzdem.
      </P>
    </>
  );
}

function Aufstellung() {
  return (
    <>
      <Lead>Elf auf dem Platz, vier in Lauerstellung.</Lead>
      <P>
        <b>Formationen:</b> Per Knopf wählst du{" "}
        {SELECTABLE_FORMATIONS.join(", ")}. Erlaubt sind außerdem{" "}
        {FORMATIONS.filter(
          (f) => !(SELECTABLE_FORMATIONS as readonly string[]).includes(f),
        ).join(", ")}
        ; die entstehen, wenn du gezielt Spieler tauschst. Zum Tauschen tippst
        du zwei Spieler nacheinander an. Die App zeigt dir, wer passt, und
        speichert sofort.
      </P>
      <P>
        <b>Die Bank springt ein.</b> Spielt einer deiner Starter keine einzige
        Minute, rückt automatisch der erste Bankspieler derselben Position nach,
        der gespielt hat. Gesucht wird der Reihe nach: B1, B2, B3. Den Torwart
        ersetzt nur der Ersatztorwart. Nachrücker bekommen keinen
        Startelf-Bonus.
      </P>
      <Tip>
        <b>Tipp:</b> B1 ist der wichtigste Platz auf der Bank. Setz dort
        jemanden hin, der sicher spielt.
      </Tip>
      <P>
        <b>Der Kapitän</b> zählt doppelt, im Guten wie im Schlechten: Aus −9
        werden −18. Spielt er gar nicht, verfällt die Verdopplung. Einen Vize
        gibt es nicht.
      </P>
    </>
  );
}

function Fixiert() {
  const lead = RULES.lockLeadMinutes;
  return (
    <>
      <Lead>{lead} Minuten vor Anpfiff ist Schluss.</Lead>
      <P>
        Jeder Spieler wird{" "}
        <b>{lead} Minuten vor dem Anpfiff seines eigenen Spiels</b> fixiert. Ab
        dann kann er weder rein noch raus, nicht umsortiert werden und nicht
        Kapitän werden oder aufhören, es zu sein.
      </P>
      <P>
        Alle anderen bleiben frei. Spielt dein Stürmer am Freitag, ist er ab
        Freitagabend fixiert. Deine Sonntagsspieler kannst du bis Sonntag noch
        tauschen, etwa wenn am Samstag eine Verletzung bekannt wird. Das Schloss
        am Spieler zeigt dir, wie lange er noch frei ist.
      </P>
      <Tip>
        <b>Spionieren erlaubt, aber fair:</b> Die Aufstellungen der anderen
        siehst du Spieler für Spieler, sobald er fixiert ist. Vorher sieht
        niemand deine Pläne.
      </Tip>
    </>
  );
}

function Punkte() {
  const { baseline, factor, fullMinutes } = SCORING.rating;
  const min = SCORING.defenseMinMinutes;
  const same = (n: number) => POS.map(() => signedInt(n));
  const ex = strikerExample();
  return (
    <>
      <Lead>Jeder Punkt kommt vom Platz.</Lead>
      <P>
        <b>Die Note.</b> Grundlage ist die Spielernote. Eine {de(baseline)} ist
        neutral. Jede volle Note darüber bringt {factor} Punkte, jede darunter
        kostet {factor}. Ab {fullMinutes} Minuten zählt die Note voll, bei
        kürzeren Einsätzen anteilig.
      </P>
      <P>
        <b>Die Ereignisse:</b>
      </P>
      <Table
        head={["", ...POS_LABEL]}
        rows={[
          ["Tor", ...perPos(SCORING.goal)],
          ["Vorlage", ...perPos(SCORING.assist)],
          [`Zu null (ab ${min} Min.)`, ...perPos(SCORING.cleanSheet)],
          [
            `Jedes Gegentor ab dem 2. (ab ${min} Min.)`,
            ...perPos(SCORING.concededFromSecond),
          ],
          ["Elfmeter gehalten", ...perPos(SCORING.penSaved)],
          ["Elfmeter verschossen", ...same(SCORING.penMissed)],
          ["Eigentor", ...same(SCORING.ownGoal)],
          ["Gelb", ...same(SCORING.yellow)],
          ["Gelb-Rot", ...same(SCORING.yellowRed)],
          ["Rot", ...same(SCORING.red)],
        ]}
      />
      <P>
        <b>Startelf-Bonus:</b> {signedInt(SCORING.startBonus)}, wenn dein
        Starter auch im echten Spiel von Beginn an spielt.
      </P>
      <P>
        <b>Beispiel:</b> Dein Stürmer spielt 90 Minuten, Note 7,8, ein Tor, eine
        Vorlage, Gelb.
      </P>
      <Table
        head={["Note", "Tor", "Vorlage", "Gelb", "Startelf", "Summe"]}
        rows={[
          [
            signedInt(ex.rating),
            signedInt(ex.goal),
            signedInt(ex.assist),
            signedInt(ex.yellow),
            signedInt(ex.startBonus),
            <b key="sum" className="text-lampe">
              {ex.total}
            </b>,
          ],
        ]}
      />
      <P>
        Als Kapitän: <b className="text-lampe">{ex.captain}</b>.
      </P>
      <Tip>
        <b>Wann kommen die Punkte?</b> Nicht live, sondern etwa zweieinhalb
        Stunden nach dem Anpfiff, sobald die Daten da sind. Bis zur Abrechnung
        sind sie vorläufig, danach endgültig.
      </Tip>
    </>
  );
}

function Transfers() {
  const free = RULES.freeTransfersPerMatchday;
  return (
    <>
      <Lead>Kaufen, verkaufen, zocken.</Lead>
      <P>
        <b>Preise.</b> Der Startpreis richtet sich nach dem echten Marktwert,
        von {de(MARKET.startPriceMin)} bis {de(MARKET.startPriceMax)} Mio. Nach
        jedem abgerechneten Spieltag bewegt sich der Preis: Hat ein Spieler
        besser gespielt als in seinen letzten {MARKET.formWindow} Einsätzen,
        steigt er, sonst fällt er, um höchstens {de(MARKET.deltaCap * 100)} %
        pro Spieltag. Wer nicht spielt, behält seinen Preis.
      </P>
      <P>
        <b>Transfers</b> sind immer ein Tausch: Du verkaufst einen Spieler und
        kaufst einen anderen auf derselben Position, zum aktuellen Preis, ohne
        Gebühr. Der Neue übernimmt genau den Platz des Alten.
      </P>
      <List>
        <Li>
          <b>Transferfenster:</b> von der Abrechnung (meist Montagmorgen) bis
          zur ersten Sperre des nächsten Spieltags. Während eines Spieltags
          änderst du nur die Aufstellung.
        </Li>
        <Li>
          <b>{free} freie Transfers pro Spieltag.</b> Einen ungenutzten nimmst
          du mit, also höchstens {free + RULES.maxCarryOver}.
        </Li>
        <Li>
          <b>Jeder weitere kostet {RULES.extraTransferPenalty} Punkte</b> auf
          dem nächsten Spieltag. Manchmal lohnt sich das trotzdem.
        </Li>
        <Li>
          <b>Pausen sind Umbauzeit.</b> In der Länderspiel- und der Winterpause
          (ab {RULES.breakMinDays} Tagen ohne Spieltag) sind Transfers
          unbegrenzt und kostenlos.
        </Li>
      </List>
      <P>
        <b>Guthaben und Kaderwert</b> zeigen, wie gut du handelst. Gewertet
        werden aber nur Punkte. Geld ist Mittel zum Zweck: Wer klug verkauft,
        kann sich später den Spieler leisten, der den Unterschied macht.
      </P>
      <Tip>
        <b>Spieltagsprämie:</b> Liegst du an einem Spieltag über der mittleren
        Punktzahl der Runde, gibt es {de(MARKET.bonusPerPoint)} Mio. pro Punkt
        darüber, höchstens {de(MARKET.bonusCap)} Mio.
      </Tip>
    </>
  );
}

function Woche() {
  return (
    <>
      <Lead>Deine Woche mit Flutlicht.</Lead>
      <Table
        head={["Wann", "Was passiert"]}
        rows={[
          [
            "Montag, 8–10 Uhr",
            "Abrechnung: Punkte endgültig, Preise neu, Transferfenster offen.",
          ],
          ["Di bis Fr", "Markt beobachten, tauschen, Aufstellung basteln."],
          [
            "24 und 3 Std. vorher",
            "Push-Erinnerung, falls du noch was ändern willst.",
          ],
          [
            `${RULES.lockLeadMinutes} Min. vor dem ersten Anpfiff`,
            "Die ersten Spieler sind fixiert, das Transferfenster schließt.",
          ],
          [
            "Wochenende",
            "Nach jedem Spiel kommen die Punkte rein, abends das Tagesfazit.",
          ],
          [
            "Montag",
            "Abrechnung, Spieltagssieger, und alles geht von vorn los.",
          ],
        ]}
      />
      <P>
        In Englischen Wochen wird am Morgen nach dem letzten Spiel abgerechnet.
      </P>
    </>
  );
}

function Tabelle({ facts }: { facts: GuideFacts }) {
  return (
    <>
      <Lead>Wer ist der Beste im Land?</Lead>
      <List>
        <Li>
          <b>Gesamttabelle:</b> Summe aller Spieltagspunkte. Bei Gleichstand
          zählen erst die Spieltagssiege, dann der beste einzelne Spieltag.
        </Li>
        <Li>
          <b>Spieltagssieger:</b> die meisten Punkte an einem Spieltag. Bei
          Gleichstand gewinnen alle.
        </Li>
        <Li>
          <b>Später eingestiegen?</b> Du startest mit 0 Punkten ab deinem ersten
          Spieltag und bekommst dasselbe Startbudget. Um den Spieltagssieg
          spielst du sofort mit.
        </Li>
      </List>
      <P>Gewertet wird ab Spieltag {facts.firstScoredMatchday}.</P>
    </>
  );
}

function Wissen() {
  return (
    <>
      <Lead>Das Kleingedruckte.</Lead>
      <List>
        <Li>
          <b>Verlegtes Spiel?</b> Es zählt nur, wenn es vor der Abrechnung und
          höchstens {RULES.postponedGraceDays} Tage nach dem ursprünglichen
          Termin stattfindet. Sonst bekommen seine Spieler 0 Punkte, und die
          Bank springt ein.
        </Li>
        <Li>
          <b>Spieler wechselt den Verein?</b> Innerhalb der Bundesliga bleibt er
          in deinem Kader. Verlässt er die Liga, punktet er nicht mehr, du
          kannst ihn aber zum letzten Preis verkaufen.
        </Li>
        <Li>
          <b>Passwort vergessen?</b> Der Admin gibt dir einen Reset-Code.
        </Li>
        <Li>
          <b>Keine Push-Nachrichten auf dem iPhone?</b> Die gibt es nur, wenn
          Flutlicht auf dem Home-Bildschirm liegt (Optionen → „Flutlicht als
          App“). Welche du bekommst, stellst du ebenfalls unter Optionen ein.
        </Li>
      </List>
    </>
  );
}

export function GuideChapter({
  id,
  facts,
}: {
  id: GuideChapterId;
  facts: GuideFacts;
}) {
  switch (id) {
    case "idee":
      return <Idee facts={facts} />;
    case "start":
      return <Start facts={facts} />;
    case "aufstellung":
      return <Aufstellung />;
    case "fixiert":
      return <Fixiert />;
    case "punkte":
      return <Punkte />;
    case "transfers":
      return <Transfers />;
    case "woche":
      return <Woche />;
    case "tabelle":
      return <Tabelle facts={facts} />;
    case "wissen":
      return <Wissen />;
  }
}
