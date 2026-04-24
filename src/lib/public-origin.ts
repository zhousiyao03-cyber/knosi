/**
 * Derive the public-facing origin (scheme + host) for the current request.
 *
 * Inside the k3s pod the Next.js listener binds to `http://0.0.0.0:3000`, so
 * `request.nextUrl.origin` leaks that internal address into any URL we build
 * from it (OAuth discovery metadata, WWW-Authenticate challenges, etc.).
 *
 * We prefer signals in this order:
 *
 *   1. `AUTH_URL` env var — the canonical public URL that NextAuth already
 *      uses. Stable across which host the request happened to hit, and not
 *      vulnerable to the hop-by-hop proto mangling below.
 *   2. `X-Forwarded-Proto` + `X-Forwarded-Host` — only trustworthy when they
 *      actually arrive intact. In our k3s setup Caddy→Traefik→pod, Traefik
 *      rewrites X-Forwarded-Proto to `http` on the pod-facing hop, so these
 *      headers frequently undersell the real protocol. We still honor them
 *      as a fallback for environments without `AUTH_URL` set.
 *   3. `request.url` origin — last-resort dev fallback.
 */
export function getPublicOrigin(request: Request): string {
  const authUrl = process.env.AUTH_URL;
  if (authUrl) {
    try {
      return new URL(authUrl).origin;
    } catch {
      // fall through to forwarded headers
    }
  }

  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedHost && forwardedProto) {
    const proto = forwardedProto.split(",")[0]!.trim();
    const host = forwardedHost.split(",")[0]!.trim();
    if (proto && host) {
      return `${proto}://${host}`;
    }
  }

  return new URL(request.url).origin;
}
