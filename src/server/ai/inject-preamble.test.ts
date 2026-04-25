import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { injectPreambleIntoLatestUser } from "./inject-preamble";

describe("injectPreambleIntoLatestUser", () => {
  it("returns the messages array unchanged when preamble is empty", () => {
    const messages: ModelMessage[] = [{ role: "user", content: "hello" }];
    const out = injectPreambleIntoLatestUser(messages, "");
    expect(out).toEqual(messages);
    expect(out).not.toBe(messages);
  });

  it("prepends preamble onto the latest user message (string content)", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "second" },
    ];
    const out = injectPreambleIntoLatestUser(
      messages,
      "<context>X</context>\n\n"
    );
    expect(out[0]).toEqual({ role: "user", content: "first" });
    expect(out[1]).toEqual({ role: "assistant", content: "ack" });
    expect(out[2]).toEqual({
      role: "user",
      content: "<context>X</context>\n\nsecond",
    });
  });

  it("prepends preamble onto the latest user message (parts array content)", () => {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "the question" }],
      },
    ];
    const out = injectPreambleIntoLatestUser(messages, "PRE\n\n");
    expect(out[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "PRE\n\nthe question" }],
    });
  });

  it("returns the array unchanged when there is no user message", () => {
    const messages: ModelMessage[] = [
      { role: "assistant", content: "lone assistant turn" },
    ];
    const out = injectPreambleIntoLatestUser(messages, "PRE");
    expect(out).toEqual(messages);
  });

  it("does not mutate the input array or its messages", () => {
    const original: ModelMessage[] = [{ role: "user", content: "hi" }];
    const snapshot = JSON.parse(JSON.stringify(original));
    injectPreambleIntoLatestUser(original, "PRE\n");
    expect(original).toEqual(snapshot);
  });
});
