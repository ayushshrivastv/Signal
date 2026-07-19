import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { signalWidgetHtml } from "../src/server/widget.js";

describe("Signal widget", () => {
  it("ships parseable inline JavaScript for the ChatGPT iframe", () => {
    const html = signalWidgetHtml();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    expect(script).toBeTruthy();
    expect(() => new vm.Script(script ?? "")).not.toThrow();
  });

  it("renders score mode without market, highlight, or fan pulse panels", () => {
    const html = signalWidgetHtml();

    expect(html).toContain("Match score");
    expect(html).toContain("FIFA World Cup 2026");
    expect(html).not.toContain("Recent highlights");
    expect(html).not.toContain("Market pulse");
    expect(html).not.toContain("Signal market");
    expect(html).not.toContain("Fan pulse");
    expect(html).not.toContain("Recent TxLINE signals");
  });
});
