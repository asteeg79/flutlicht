import { expect, it } from "vitest";
import { byCodeUnit } from "../src/order";

it("byCodeUnit sortiert wie sort() ohne Argument (Dateinamen, ISO-Zeitstempel)", () => {
  const names = [
    "round-10.json",
    "Round-2.json",
    "round-02.json",
    "16434026",
    "2026-11-19T07:00:00.000Z",
    "2026-11-09T07:00:00.000Z",
    "ä.json",
    "a.json",
  ];
  expect([...names].sort(byCodeUnit)).toEqual([...names].sort());
});
