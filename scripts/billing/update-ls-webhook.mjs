// List current LS webhooks and update callback URL to production.
import { lemonSqueezySetup, listWebhooks, updateWebhook } from "@lemonsqueezy/lemonsqueezy.js";
lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });

const storeId = process.env.LEMONSQUEEZY_STORE_ID;
const targetUrl = "https://www.knosi.xyz/api/webhooks/lemon-squeezy";

const { data, error } = await listWebhooks({ filter: { storeId } });
if (error) { console.log("list error:", error); process.exit(1); }

for (const wh of data.data) {
  console.log(`webhook ${wh.id}: ${wh.attributes.url} (events: ${wh.attributes.events.length})`);
  if (wh.attributes.url !== targetUrl) {
    const { error: upErr } = await updateWebhook(wh.id, { url: targetUrl });
    if (upErr) { console.log(`  ❌ update failed: ${upErr.message}`); continue; }
    console.log(`  ✅ updated → ${targetUrl}`);
  } else {
    console.log(`  ⏭  already points at prod`);
  }
}
