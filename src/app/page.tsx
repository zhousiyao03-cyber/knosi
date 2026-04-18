import { redirect } from "next/navigation";
import { getRequestSession } from "@/server/auth/request-session";
import { LandingPage } from "@/components/marketing/landing-page";
import { faqs, GITHUB_URL } from "@/components/marketing/landing-data";

const SITE_URL = "https://www.knosi.xyz";

const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Knosi",
  description:
    "Self-hostable, AI-native second brain. Capture Claude and ChatGPT outputs into searchable, reusable knowledge, and ask AI across your own corpus.",
  url: SITE_URL,
  image: `${SITE_URL}/knosi-logo.png`,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Linux, macOS, Windows",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  sameAs: [GITHUB_URL],
};

const faqPageLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

export default async function RootPage() {
  const session = await getRequestSession();
  if (session) {
    redirect("/dashboard");
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }}
      />
      <LandingPage />
    </>
  );
}
