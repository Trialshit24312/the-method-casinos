/** Fetch operator homepage HTML from the user's browser (bypasses server/datacenter blocks). */

const FETCH_TIMEOUT_MS = 14_000;

export async function fetchPageHtmlInBrowser(url: string): Promise<string | null> {
  const target = url.startsWith('http') ? url : `https://${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    return html.length >= 200 ? html.slice(0, 500_000) : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function fetchPagesInBrowser(urls: string[]): Promise<{ url: string; html: string }[]> {
  const out: { url: string; html: string }[] = [];
  for (const url of urls) {
    const html = await fetchPageHtmlInBrowser(url);
    if (html) out.push({ url, html });
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}
