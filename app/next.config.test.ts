// Sicherheits-Header aus next.config.js (Security-Wochenscan, ZAP).
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const nextConfig = createRequire(import.meta.url)("./next.config.js");

describe("Sicherheits-Header", () => {
  it("setzen COOP und COEP für alle Pfade", async () => {
    const [regel] = await nextConfig.headers();
    expect(regel.source).toBe("/:path*");
    const header = Object.fromEntries(
      regel.headers.map((h: { key: string; value: string }) => [
        h.key,
        h.value,
      ]),
    );
    expect(header["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(header["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
  });
});
