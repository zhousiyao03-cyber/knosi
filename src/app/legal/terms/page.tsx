export const dynamic = "force-static";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Knosi (knosi.xyz).",
};

const EFFECTIVE_DATE = "April 24, 2026";

export default function TermsPage() {
  return (
    <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed">
      <h1>Terms of Service</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of the Knosi hosted service available at{" "}
        <a href="https://www.knosi.xyz">www.knosi.xyz</a> (the
        &ldquo;Service&rdquo;), operated by the Knosi team (&ldquo;Knosi&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using
        the Service you agree to be bound by these Terms. If you do not agree,
        do not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        Knosi is a web-based personal knowledge management application that
        lets individual users write, organize, and search their own notes and
        ask AI-assisted questions across their own content. The Service is
        offered as a hosted software-as-a-service (SaaS) subscription. An
        open-source self-hosted distribution is also available separately under
        its own license.
      </p>

      <h2>2. Eligibility and Accounts</h2>
      <p>
        You must be at least 13 years old (or the minimum digital-consent age
        in your jurisdiction, whichever is higher) to use the Service. You are
        responsible for:
      </p>
      <ul>
        <li>Providing accurate account information.</li>
        <li>Keeping your login credentials secure.</li>
        <li>All activity that occurs under your account.</li>
      </ul>
      <p>
        Accounts are personal. You may not share, sell, or transfer your
        account to another person.
      </p>

      <h2>3. Subscriptions, Pricing, and Billing</h2>
      <p>
        The Service offers a Free tier and a paid Pro tier. Current pricing and
        plan limits are published at{" "}
        <a href="/pricing">/pricing</a> and are incorporated into these Terms
        by reference.
      </p>
      <ul>
        <li>
          <strong>Pro subscription:</strong> billed monthly or annually in
          advance, in U.S. dollars, through our payment processor Lemon
          Squeezy. Lemon Squeezy acts as the merchant of record and handles tax
          collection where applicable.
        </li>
        <li>
          <strong>Automatic renewal:</strong> paid subscriptions renew
          automatically at the end of each billing period using the payment
          method on file, until cancelled.
        </li>
        <li>
          <strong>Cancellation:</strong> you may cancel a Pro subscription at
          any time from the billing portal. Cancellation takes effect at the
          end of the current paid period; you keep Pro access until then.
        </li>
        <li>
          <strong>Price changes:</strong> we may change prices for future
          billing periods. Material price changes will be announced by email
          and/or in-product at least 30 days in advance. Continued use after
          the change takes effect constitutes acceptance.
        </li>
      </ul>
      <p>
        Refund terms are described in the separate{" "}
        <a href="/legal/refund">Refund Policy</a>.
      </p>

      <h2>4. Your Content</h2>
      <p>
        You retain all ownership rights in the notes, files, images, and other
        content you upload to or create within the Service (&ldquo;Your
        Content&rdquo;). You grant Knosi a limited, worldwide, non-exclusive,
        royalty-free license to host, store, transmit, and display Your Content
        solely as necessary to operate and provide the Service to you. This
        license ends when Your Content is deleted from the Service, except for
        backups retained for a limited period as described in our{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>
      <p>
        You are solely responsible for Your Content and for having the rights
        necessary to store it in the Service. We do not claim ownership over
        Your Content and do not use it to train third-party AI models.
      </p>

      <h2>5. AI Features</h2>
      <p>
        The Service includes AI features (such as &ldquo;Ask AI&rdquo;,
        summarization, and content capture). To provide these features, the
        relevant portions of Your Content and your prompts may be sent to
        third-party AI providers (such as Anthropic and OpenAI) or to your own
        configured provider. AI output can be inaccurate or incomplete; you are
        responsible for verifying any AI-generated content before relying on
        it. See the <a href="/legal/privacy">Privacy Policy</a> for details on
        how AI requests are handled.
      </p>

      <h2>6. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service in violation of any applicable law or to store,
          generate, or distribute illegal content.
        </li>
        <li>
          Upload content that infringes intellectual property, privacy,
          publicity, or other rights of any third party.
        </li>
        <li>
          Upload malware, attempt to gain unauthorized access, probe for
          vulnerabilities, or otherwise interfere with the integrity or
          security of the Service.
        </li>
        <li>
          Use the Service to harass, defame, or harm others; to generate
          sexual content involving minors; or to produce content that promotes
          violence or self-harm.
        </li>
        <li>
          Resell, white-label, or operate the hosted Service as a commercial
          offering to third parties without our written permission. (The open
          source self-hosted version is governed by its own license.)
        </li>
        <li>
          Use the Service to train machine-learning models that compete with
          the Service.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these rules, with or
        without notice where the violation creates legal, security, or abuse
        risk.
      </p>

      <h2>7. Fair Use and Rate Limits</h2>
      <p>
        Plan limits (including daily AI-call quotas, storage, and note counts)
        are published on the pricing page and enforced programmatically to
        protect Service stability and cost. We reserve the right to apply
        reasonable rate limits to prevent abuse.
      </p>

      <h2>8. Service Availability</h2>
      <p>
        We aim to keep the Service available at all times but do not guarantee
        uninterrupted or error-free operation. The Service is provided on an
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We may
        perform scheduled maintenance, deploy updates, and change or remove
        features over time.
      </p>

      <h2>9. Data Export and Account Deletion</h2>
      <p>
        You can export your data from <strong>Settings &rarr; Export</strong>{" "}
        at any time, on any plan. You can delete your account at any time; on
        deletion, your account data is removed from production systems within
        a reasonable period, subject to limited retention for backups, legal
        compliance, fraud prevention, and accounting.
      </p>

      <h2>10. Intellectual Property</h2>
      <p>
        The Service, including its software, design, trademarks, and
        documentation (excluding Your Content and excluding components licensed
        under open source licenses), is owned by Knosi and its licensors. No
        rights are granted except as expressly set out in these Terms.
      </p>

      <h2>11. Third-Party Services</h2>
      <p>
        The Service relies on third-party infrastructure and services,
        including Lemon Squeezy (billing), Turso (database), Cloudflare R2
        (object storage), Cloudflare (CDN and analytics), and AI providers
        such as Anthropic and OpenAI. Your use of the Service is also subject
        to these providers&rsquo; terms where applicable.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any
        kind, express or implied, including merchantability, fitness for a
        particular purpose, and non-infringement. We do not warrant that the
        Service will be uninterrupted, timely, secure, or error-free, or that
        AI output will be accurate.
      </p>

      <h2>13. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Knosi and its operators will
        not be liable for any indirect, incidental, special, consequential, or
        punitive damages, or any loss of profits or revenues, data, or
        goodwill arising out of or related to your use of the Service. Our
        total aggregate liability for any claim arising out of or related to
        the Service is limited to the greater of (a) the amount you paid us in
        the 12 months preceding the event giving rise to the claim, or (b)
        USD 100.
      </p>

      <h2>14. Indemnification</h2>
      <p>
        You agree to indemnify and hold Knosi harmless from any claims,
        damages, liabilities, costs, and expenses (including reasonable
        attorneys&rsquo; fees) arising from Your Content, your use of the
        Service, or your violation of these Terms.
      </p>

      <h2>15. Termination</h2>
      <p>
        You can stop using the Service at any time. We may suspend or
        terminate your access if you violate these Terms, create risk or
        liability for us or other users, or stop operating the Service.
        Sections intended to survive termination (including ownership,
        disclaimers, limitation of liability, and indemnification) will
        survive.
      </p>

      <h2>16. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we make material
        changes, we will update the effective date and notify you by email or
        in-product. Continued use of the Service after changes take effect
        constitutes acceptance.
      </p>

      <h2>17. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which the
        Knosi operator is established, without regard to conflict-of-laws
        rules. You and Knosi agree to try in good faith to resolve any
        dispute informally first by contacting{" "}
        <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>.
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>.
      </p>
    </article>
  );
}
