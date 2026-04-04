export interface RepoInfo {
  fullName: string;
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    const parts = input.trim().split("/").filter(Boolean);
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  }
}

export async function fetchRepoInfo(input: string): Promise<RepoInfo> {
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    throw new Error("Invalid GitHub URL or owner/repo format");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SecondBrain/1.0",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found: ${parsed.owner}/${parsed.repo}`);
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    full_name: string;
    name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    html_url: string;
  };

  return {
    fullName: data.full_name,
    name: data.name,
    description: data.description ?? "",
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    url: data.html_url,
  };
}
