// Nur für E2E-Tests: legt Einladungs- und Reset-Codes direkt im lokalen Storage an
// (die Admin-Oberfläche dafür folgt in M10). Aufruf:
//   tsx e2e/seed.ts invite <CODE>
//   tsx e2e/seed.ts reset <E-MAIL> <CODE>
import { loadEmailIndex, loadLeague, saveLeague } from "@/lib/storage";

async function main() {
  const [kind, a, b] = process.argv.slice(2);
  const league = await loadLeague();
  const createdAt = new Date().toISOString();

  if (kind === "invite" && a) {
    await saveLeague({
      ...league,
      invites: [...league.invites, { code: a, createdAt }],
    });
  } else if (kind === "reset" && a && b) {
    const userId = (await loadEmailIndex())[a];
    if (!userId) throw new Error(`Kein Konto für ${a}`);
    await saveLeague({
      ...league,
      resets: [...league.resets, { code: b, userId, createdAt }],
    });
  } else {
    throw new Error("Aufruf: seed.ts invite <CODE> | reset <E-MAIL> <CODE>");
  }
}

void main();
