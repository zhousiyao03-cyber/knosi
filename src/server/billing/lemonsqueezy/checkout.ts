// src/server/billing/lemonsqueezy/checkout.ts
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getLemonSqueezyClient } from "./client";

export type CheckoutVariant = "monthly" | "annual";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function createCheckoutUrl(
  userId: string,
  variant: CheckoutVariant,
): Promise<string> {
  // Ensures lemonSqueezySetup() has run and LEMONSQUEEZY_API_KEY is present.
  getLemonSqueezyClient();

  const storeId = requireEnv("LEMONSQUEEZY_STORE_ID");
  const variantId =
    variant === "monthly"
      ? requireEnv("LEMONSQUEEZY_VARIANT_MONTHLY")
      : requireEnv("LEMONSQUEEZY_VARIANT_ANNUAL");

  const authUrl = process.env.AUTH_URL;
  if (!authUrl) {
    // Non-fatal for the SDK call, but the redirect would point nowhere useful.
    console.warn(
      "[billing] AUTH_URL is not set; checkout redirectUrl will be undefined",
    );
  }

  const { data, error } = await createCheckout(storeId, variantId, {
    checkoutData: {
      custom: { user_id: userId },
    },
    productOptions: authUrl
      ? { redirectUrl: `${authUrl}/settings/billing?status=success` }
      : undefined,
  });

  if (error) {
    throw new Error(`LS checkout failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("LS checkout failed: empty response");
  }

  return data.data.attributes.url;
}
