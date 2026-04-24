export const dynamic = "force-static";

export const metadata = {
  title: "Refund Policy",
  description: "Refund Policy for Knosi Pro subscriptions.",
};

const EFFECTIVE_DATE = "April 24, 2026";

export default function RefundPage() {
  return (
    <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed">
      <h1>Refund Policy</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <p>
        We want you to be happy with Knosi Pro. This Refund Policy explains
        when and how you can request a refund for a Pro subscription
        purchased at <a href="https://www.knosi.xyz">www.knosi.xyz</a>.
      </p>

      <h2>1. 14-Day Money-Back Guarantee</h2>
      <p>
        If you are a <strong>first-time</strong> Pro subscriber and you are
        not satisfied with the Service, you may request a full refund within{" "}
        <strong>14 days</strong> of the initial purchase.
      </p>
      <ul>
        <li>Applies to your first paid subscription only.</li>
        <li>Applies to both monthly and annual plans.</li>
        <li>Available once per account.</li>
      </ul>

      <h2>2. Cancellations After the 14-Day Window</h2>
      <p>
        You can cancel a Pro subscription at any time from{" "}
        <strong>Settings &rarr; Billing</strong>. When you cancel:
      </p>
      <ul>
        <li>
          <strong>Monthly plan:</strong> the subscription stays active until
          the end of the current billing month. No partial-month refunds are
          issued.
        </li>
        <li>
          <strong>Annual plan:</strong> the subscription stays active until
          the end of the current annual period. We do not automatically
          pro-rate refunds for unused months after the 14-day window, but we
          will review pro-rata refund requests in good faith on a
          case-by-case basis &mdash; email{" "}
          <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>.
        </li>
      </ul>

      <h2>3. Situations That Are Not Eligible</h2>
      <p>Refunds will generally not be granted in the following cases:</p>
      <ul>
        <li>
          Requests made more than 14 days after the initial subscription
          purchase (subject to Section 2 above).
        </li>
        <li>
          Accounts suspended or terminated for violating our{" "}
          <a href="/legal/terms">Terms of Service</a> (e.g., abuse, fraud,
          illegal content).
        </li>
        <li>
          Repeat purchases &mdash; the 14-day guarantee is a one-time benefit
          per account.
        </li>
        <li>
          Fees already paid to third parties (e.g., taxes collected by the
          payment processor in some jurisdictions) may be non-refundable where
          local law does not require otherwise.
        </li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <ol>
        <li>
          Email <a href="mailto:support@knosi.xyz">support@knosi.xyz</a> from
          the email address associated with your Knosi account.
        </li>
        <li>
          Include the subject line <em>&ldquo;Refund request&rdquo;</em>.
        </li>
        <li>
          Tell us briefly why you&rsquo;re asking for a refund &mdash; this
          helps us improve the product. (Optional, but appreciated.)
        </li>
      </ol>
      <p>
        We aim to respond within <strong>2 business days</strong>. Approved
        refunds are processed through our payment provider, Lemon Squeezy,
        and typically appear on your original payment method within 5&ndash;10
        business days depending on your bank.
      </p>

      <h2>5. Statutory Rights</h2>
      <p>
        Nothing in this policy limits any refund or withdrawal rights you may
        have under applicable consumer-protection law (for example, the EU
        consumer right of withdrawal). This policy sits on top of those
        rights, not in place of them.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions about refunds? Email{" "}
        <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>.
      </p>
    </article>
  );
}
