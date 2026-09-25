// Übernommen aus WM-Tipp pipeline/src/util/text.ts, angepasst: nur foldDiacritics und alnumKey;
// Buchstaben ohne Unicode-Zerlegung (ø, æ, ß, ł, đ, ı …) werden zusätzlich umgeschrieben.

const SPECIAL: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

/** Kleinbuchstaben + Diakritika entfernen ("Chaïbi" → "chaibi", "Rønnow" → "ronnow"). */
export function foldDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øæœßłđðþı]/g, (c) => SPECIAL[c]!);
}

/** Vergleichsschlüssel: foldDiacritics + alles außer [a-z0-9] entfernen ("Van Den Bosch" → "vandenbosch"). */
export function alnumKey(s: string): string {
  return foldDiacritics(s).replace(/[^a-z0-9]/g, "");
}
