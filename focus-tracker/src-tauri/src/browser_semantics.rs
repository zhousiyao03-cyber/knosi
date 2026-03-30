use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSemantics {
    pub browser_host: Option<String>,
    pub browser_path: Option<String>,
    pub browser_search_query: Option<String>,
    pub browser_surface_type: Option<String>,
}

pub fn extract_browser_semantics(
    browser_url: Option<&str>,
    browser_page_title: Option<&str>,
) -> BrowserSemantics {
    let Some(browser_url) = browser_url else {
        return BrowserSemantics {
            browser_host: None,
            browser_path: None,
            browser_search_query: None,
            browser_surface_type: None,
        };
    };

    let Ok(parsed) = Url::parse(browser_url) else {
        return BrowserSemantics {
            browser_host: None,
            browser_path: None,
            browser_search_query: None,
            browser_surface_type: None,
        };
    };

    let host = parsed.host_str().map(|value| value.to_ascii_lowercase());
    let path = normalize_path(parsed.path());
    let title = browser_page_title.map(|value| value.trim().to_ascii_lowercase());
    let search_query = extract_search_query(&parsed);
    let surface_type = classify_surface_type(host.as_deref(), path.as_deref(), title.as_deref());

    BrowserSemantics {
        browser_host: host,
        browser_path: path,
        browser_search_query: search_query,
        browser_surface_type: surface_type,
    }
}

fn normalize_path(path: &str) -> Option<String> {
    let normalized = path.trim();
    if normalized.is_empty() || normalized == "/" {
        None
    } else {
        Some(normalized.to_string())
    }
}

fn extract_search_query(parsed: &Url) -> Option<String> {
    let host = parsed.host_str()?.to_ascii_lowercase();
    let key = match host.as_str() {
        "www.google.com" | "google.com" | "www.bing.com" | "bing.com" | "duckduckgo.com"
        | "www.duckduckgo.com" | "www.perplexity.ai" | "perplexity.ai" => "q",
        "chatgpt.com" => "q",
        _ => return None,
    };

    parsed
        .query_pairs()
        .find(|(current, _)| current == key)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn classify_surface_type(
    host: Option<&str>,
    path: Option<&str>,
    title: Option<&str>,
) -> Option<String> {
    let host = host?;
    let path = path.unwrap_or("/");

    if matches!(host, "www.google.com" | "google.com") && path == "/search" {
        return Some("search".into());
    }

    if host.contains("perplexity.ai") {
        return Some("search".into());
    }

    if host.contains("github.com") {
        if path.contains("/pull/") {
            return Some("pr".into());
        }
        if path.contains("/issues/") {
            return Some("issue".into());
        }
        return Some("repo".into());
    }

    if host.contains("linear.app") || host.contains("atlassian.net") {
        if path.contains("/issue/") || path.contains("/browse/") {
            return Some("issue".into());
        }
    }

    if host.contains("chatgpt.com") || host.contains("claude.ai") || host.contains("gemini.google.com")
    {
        return Some("chat".into());
    }

    if host.contains("docs.google.com")
        || host.contains("notion.so")
        || host.contains("readme.com")
        || title.is_some_and(|value| value.contains("documentation"))
    {
        return Some("docs".into());
    }

    if host.contains("figma.com") {
        return Some("design".into());
    }

    if host.contains("mail.google.com") || host.contains("outlook.office.com") {
        return Some("mail".into());
    }

    if host.contains("calendar.google.com") || host.contains("calendar") {
        return Some("calendar".into());
    }

    if host.contains("youtube.com") || host.contains("youtu.be") || host.contains("vimeo.com") {
        return Some("video".into());
    }

    Some("unknown".into())
}

#[cfg(test)]
mod tests {
    use super::extract_browser_semantics;

    #[test]
    fn extracts_google_search_query_and_surface_type() {
        let result = extract_browser_semantics(
            Some("https://www.google.com/search?q=rust+tauri+accessibility&oq=rust"),
            Some("rust tauri accessibility - Google Search"),
        );

        assert_eq!(result.browser_host.as_deref(), Some("www.google.com"));
        assert_eq!(result.browser_path.as_deref(), Some("/search"));
        assert_eq!(
            result.browser_search_query.as_deref(),
            Some("rust tauri accessibility")
        );
        assert_eq!(result.browser_surface_type.as_deref(), Some("search"));
    }

    #[test]
    fn classifies_github_pull_requests() {
        let result = extract_browser_semantics(
            Some("https://github.com/openai/openai-node/pull/42"),
            Some("Add something by teammate"),
        );

        assert_eq!(result.browser_host.as_deref(), Some("github.com"));
        assert_eq!(result.browser_surface_type.as_deref(), Some("pr"));
    }

    #[test]
    fn classifies_chat_tools() {
        let result = extract_browser_semantics(
            Some("https://chatgpt.com/c/abc123"),
            Some("New chat"),
        );

        assert_eq!(result.browser_surface_type.as_deref(), Some("chat"));
    }

    #[test]
    fn classifies_perplexity_as_search() {
        let result = extract_browser_semantics(
            Some("https://www.perplexity.ai/search?q=rust+ax+api"),
            Some("rust ax api"),
        );

        assert_eq!(result.browser_search_query.as_deref(), Some("rust ax api"));
        assert_eq!(result.browser_surface_type.as_deref(), Some("search"));
    }

    #[test]
    fn classifies_linear_issue_pages() {
        let result = extract_browser_semantics(
            Some("https://linear.app/second-brain/issue/SB-42/fix-focus-label"),
            Some("SB-42 fix focus label"),
        );

        assert_eq!(result.browser_surface_type.as_deref(), Some("issue"));
    }

    #[test]
    fn returns_unknown_for_unmapped_sites() {
        let result =
            extract_browser_semantics(Some("https://example.com/path/to/page"), Some("Example"));

        assert_eq!(result.browser_host.as_deref(), Some("example.com"));
        assert_eq!(result.browser_path.as_deref(), Some("/path/to/page"));
        assert_eq!(result.browser_surface_type.as_deref(), Some("unknown"));
    }

    #[test]
    fn returns_empty_semantics_for_invalid_urls() {
        let result = extract_browser_semantics(Some("not-a-url"), Some("broken"));

        assert_eq!(result.browser_host, None);
        assert_eq!(result.browser_path, None);
        assert_eq!(result.browser_search_query, None);
        assert_eq!(result.browser_surface_type, None);
    }
}
