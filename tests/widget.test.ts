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
});
