export const GITHUB_URL = "https://github.com/zhousiyao03-cyber/knosi";

export const faqs: Array<{ q: string; a: string }> = [
  {
    q: "What is Knosi?",
    a: "Knosi is a self-hostable, AI-native second brain for developers. It helps you turn Claude and ChatGPT outputs into searchable, reusable knowledge.",
  },
  {
    q: "Is Knosi just a note-taking app?",
    a: "No. Knosi is designed around the AI workflow first. It combines note-taking, retrieval, and AI-powered querying so the output of your AI sessions becomes long-term knowledge.",
  },
  {
    q: "Why not just use Notion or Obsidian?",
    a: "Those tools are great, but they are not built around capturing and reusing AI output as a first-class workflow. Knosi is.",
  },
  {
    q: "Do I need an API key?",
    a: "Not on the hosted version at knosi.xyz — you can sign up and start using Knosi immediately. On a self-hosted instance you bring your own provider (OpenAI, Anthropic, local Claude Code, etc.), so many Claude-heavy users reuse the subscription they already pay for.",
  },
  {
    q: "Can I self-host it?",
    a: "Yes. Knosi runs anywhere Node.js and SQLite run — Docker, k3s, a single VPS, or your laptop. The repository includes the full deploy setup used by knosi.xyz (Caddy + k3s on Hetzner) as a reference.",
  },
  {
    q: "Who is it for?",
    a: "Developers, AI-heavy knowledge workers, independent builders, and anyone who wants AI outputs to become reusable knowledge instead of disposable chat history.",
  },
];
