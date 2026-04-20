// src/server/billing/mode.ts

/**
 * Single source of truth for "are we running the hosted knosi.xyz deployment?"
 * Self-hosted users never set KNOSI_HOSTED_MODE. All billing code paths guard on this.
 */
export function isHostedMode(): boolean {
  return process.env.KNOSI_HOSTED_MODE === "true";
}
