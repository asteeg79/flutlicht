import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv";

describe("parseCsv", () => {
  it("liest Kopfzeile, Anführungszeichen, Kommas und Zeilenumbrüche in Feldern", () => {
    const text = 'a,b,c\n1,"x, y","he said ""hi"""\r\n2,"zwei\nZeilen",\n';
    expect(parseCsv(text)).toEqual([
      { a: "1", b: "x, y", c: 'he said "hi"' },
      { a: "2", b: "zwei\nZeilen", c: "" },
    ]);
  });
  it("kommt ohne abschließenden Zeilenumbruch und mit leerer Eingabe aus", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
    expect(parseCsv("")).toEqual([]);
  });
});
