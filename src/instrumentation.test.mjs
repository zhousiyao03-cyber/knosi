import test from "node:test";
import assert from "node:assert/strict";

import instrumentationModule from "./instrumentation.ts";

const { hasTracingConfig, register } = instrumentationModule;

test("hasTracingConfig is false without Langfuse config", () => {
  assert.equal(hasTracingConfig({}), false);
});

test("hasTracingConfig is true when Langfuse keys are present", () => {
  assert.equal(
    hasTracingConfig({
      LANGFUSE_PUBLIC_KEY: "pk",
      LANGFUSE_SECRET_KEY: "sk",
    }),
    true
  );
});

test("register does not install tracing when config is absent", async () => {
  let installCalls = 0;

  await assert.doesNotReject(async () => {
    await register({
      env: {},
      installNodeTracing: async () => {
        installCalls += 1;
      },
    });
  });

  assert.equal(installCalls, 0);
});
