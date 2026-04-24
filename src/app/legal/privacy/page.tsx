export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Knosi (knosi.xyz).",
};

const EFFECTIVE_DATE = "April 24, 2026";

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <p>
        This Privacy Policy explains how Knosi (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, and shares personal information when
        you use the hosted Knosi service at{" "}
        <a href="https://www.knosi.xyz">www.knosi.xyz</a> (the
        &ldquo;Service&rdquo;). The self-hosted open-source version of Knosi is
        not covered by this policy — when you run Knosi on your own
        infrastructure, you are the controller of your own data.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information you provide</h3>
      <ul>
        <li>
          <strong>Account information:</strong> email address, hashed
          password, and any profile information you add.
        </li>
        <li>
          <strong>Your content:</strong> notes, images, files, tags, portfolio
          entries, focus-tracker sessions, captured AI chats, and other data
          you create or upload to the Service.
        </li>
        <li>
          <strong>Payment information:</strong> when you upgrade to Pro,
          billing is processed by our payment processor, Lemon Squeezy. Lemon
          Squeezy collects your payment details directly — we do not store
          full card numbers on our servers. We receive and store
          subscription-status metadata (plan, renewal date, last-four digits,
          billing country) for account management and accounting.
        </li>
        <li>
          <strong>Support communications:</strong> messages you send us by
          email or via support channels.
        </li>
      </ul>

      <h3>1.2 Information collected automatically</h3>
      <ul>
        <li>
          <strong>Log and usage data:</strong> IP address, user-agent,
          timestamps, request paths, and feature usage, used to operate,
          debug, and secure the Service.
        </li>
        <li>
          <strong>Cookies and session tokens:</strong> used to keep you signed
          in and to remember session preferences. See &ldquo;Cookies&rdquo;
          below.
        </li>
        <li>
          <strong>Privacy-preserving analytics:</strong> we use Cloudflare Web
          Analytics, which does not use cookies or fingerprinting.
        </li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To provide, operate, and maintain the Service.</li>
        <li>To authenticate users and secure accounts.</li>
        <li>
          To process payments, manage subscriptions, and send billing
          receipts.
        </li>
        <li>
          To send transactional messages (security alerts, password resets,
          subscription notices).
        </li>
        <li>To respond to support requests.</li>
        <li>To detect, prevent, and respond to fraud, abuse, or security issues.</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do
        not use Your Content to train our own or any third party&rsquo;s
        machine-learning models.
      </p>

      <h2>3. AI Features and Third-Party AI Providers</h2>
      <p>
        Knosi&rsquo;s AI features (e.g., Ask AI, summarization, content
        capture) send relevant portions of Your Content and your prompts to
        third-party AI providers to generate a response. Depending on your
        configuration, this may include:
      </p>
      <ul>
        <li>
          Anthropic (Claude) &mdash; see{" "}
          <a
            href="https://www.anthropic.com/legal/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Anthropic&rsquo;s Privacy Policy
          </a>
          .
        </li>
        <li>
          OpenAI &mdash; see{" "}
          <a
            href="https://openai.com/policies/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            OpenAI&rsquo;s Privacy Policy
          </a>
          .
        </li>
        <li>Your own configured provider, if you bring your own API key.</li>
      </ul>
      <p>
        We send only the minimum content necessary (typically the most
        relevant note chunks for a query plus your prompt). We do not grant
        these providers permission to use your data to train their models;
        providers act as processors on our behalf under their enterprise API
        terms.
      </p>

      <h2>4. Third-Party Service Providers</h2>
      <p>
        We rely on a small set of infrastructure providers to run the Service:
      </p>
      <ul>
        <li>
          <strong>Hetzner Cloud</strong> &mdash; primary application hosting
          (Germany / EU).
        </li>
        <li>
          <strong>Turso (libSQL)</strong> &mdash; managed database.
        </li>
        <li>
          <strong>Cloudflare R2</strong> &mdash; image and file storage.
        </li>
        <li>
          <strong>Cloudflare</strong> &mdash; CDN, DNS, DDoS protection, and
          privacy-preserving Web Analytics.
        </li>
        <li>
          <strong>Lemon Squeezy</strong> &mdash; payment processor and
          merchant of record for Pro subscriptions.
        </li>
        <li>
          <strong>Anthropic / OpenAI</strong> &mdash; AI inference, as
          described above.
        </li>
      </ul>
      <p>
        These providers process personal information only as needed to provide
        their services to us.
      </p>

      <h2>5. Cookies</h2>
      <p>
        We use a small number of first-party cookies and similar technologies:
      </p>
      <ul>
        <li>
          <strong>Session cookie</strong> &mdash; required to keep you signed
          in.
        </li>
        <li>
          <strong>CSRF token</strong> &mdash; required for security.
        </li>
        <li>
          <strong>Preference cookies</strong> &mdash; e.g., dark/light theme.
        </li>
      </ul>
      <p>
        We do not use advertising cookies or third-party tracking cookies.
      </p>

      <h2>6. Data Retention</h2>
      <ul>
        <li>
          <strong>Account data and content</strong> are retained for as long
          as your account is active.
        </li>
        <li>
          <strong>Deleted content</strong> is removed from production systems
          promptly and purged from encrypted backups within 30 days.
        </li>
        <li>
          <strong>Billing records</strong> may be retained longer where
          required by tax, accounting, or anti-fraud law (typically up to 7
          years).
        </li>
        <li>
          <strong>Logs</strong> are retained for up to 90 days for security
          and debugging.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We use industry-standard safeguards including TLS for data in transit,
        encrypted storage, password hashing with modern algorithms, least-
        privilege access, and isolated deployment environments. No system is
        perfectly secure; please use a strong, unique password.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        The Service is hosted in the European Union (Germany). If you access
        the Service from outside the EU, your data will be transferred to and
        processed in the EU. AI inference requests are processed by providers
        in the United States.
      </p>

      <h2>9. Your Rights</h2>
      <p>
        Depending on where you live (e.g., EU/EEA, UK, California), you may
        have the right to:
      </p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Correct inaccurate information.</li>
        <li>Delete your account and associated personal data.</li>
        <li>
          Export your data (self-service at <strong>Settings &rarr; Export</strong>
          ).
        </li>
        <li>
          Object to or restrict certain processing, or withdraw consent where
          processing is based on consent.
        </li>
        <li>Lodge a complaint with your local data-protection authority.</li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>. We will
        respond within a reasonable time, consistent with applicable law.
      </p>

      <h2>10. Children</h2>
      <p>
        The Service is not directed to children under 13 (or the minimum
        digital-consent age in your jurisdiction). We do not knowingly collect
        personal information from such children. If you believe a child has
        provided us personal information, contact us and we will delete it.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy. When we make material changes, we
        will update the effective date and, where appropriate, notify you by
        email or in-product.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions or requests? Email{" "}
        <a href="mailto:support@knosi.xyz">support@knosi.xyz</a>.
      </p>
    </article>
  );
}
