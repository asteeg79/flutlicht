import { describe, expect, it } from "vitest";
import { clamp, round1, roundHalfAwayFromZero, toTenths } from "../src";

describe("roundHalfAwayFromZero", () => {
  it("rundet .5 von der Null weg", () => {
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
  });
  it("rundet unter .5 zur Null hin, ohne −0", () => {
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-0.4)).toBe(0);
    expect(Object.is(roundHalfAwayFromZero(-0.4), 0)).toBe(true);
  });
  it("fängt Fließkomma-Reste knapp unter .5 ab", () => {
    expect(roundHalfAwayFromZero(2.4999999999999996)).toBe(3);
    expect(roundHalfAwayFromZero(-0.5 - 1)).toBe(-2);
  });
});

describe("round1", () => {
  it("rundet auf 0,1 half up", () => {
    expect(round1(6.25)).toBe(6.3);
    expect(round1(6.24)).toBe(6.2);
    expect(round1(10.48)).toBe(10.5);
    expect(round1(10.45)).toBe(10.5);
  });
});

describe("clamp und toTenths", () => {
  it("begrenzt auf [min, max]", () => {
    expect(clamp(0.4, 0.5, 25)).toBe(0.5);
    expect(clamp(26, 0.5, 25)).toBe(25);
    expect(clamp(3, 0.5, 25)).toBe(3);
  });
  it("rechnet Mio. exakt in Zehntel", () => {
    expect(toTenths(0.1 + 0.2)).toBe(3);
  });
});
