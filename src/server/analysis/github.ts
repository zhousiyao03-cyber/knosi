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

export interface SearchResultItem {
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  url: string;
}

export async function searchRepos(query: string, limit = 5): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (!q) return [];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SecondBrain/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    q
  )}&sort=stars&order=desc&per_page=${limit}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub search error: ${response.status}`);
  }
  const data = (await response.json()) as {
    items: Array<{
      full_name: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      html_url: string;
    }>;
  };
  return (data.items ?? []).map((it) => ({
    fullName: it.full_name,
    description: it.description ?? "",
    language: it.language,
    stars: it.stargazers_count,
    url: it.html_url,
  }));
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
