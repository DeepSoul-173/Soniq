// Alternative YouTube extraction using yt-dlp-compatible services
// Provides fallback when InnerTube fails

const YTDLP_APIS = [
  'https://api.cobalt.tools',
  'https://yt-api.davidjwebb.dev/info',
];

async function resolveViaYtDlp(videoId: string): Promise<string | null> {
  for (const apiBase of YTDLP_APIS) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 12000);

      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'best',
          disableMetrics: true,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(tid);
      if (!res.ok) continue;

      const data = await res.json();
      if (data?.url && typeof data.url === 'string') {
        return data.url;
      }
      if (data?.stream?.url) {
        return data.stream.url;
      }
    } catch {
      // try next API
    }
  }
  return null;
}

export { resolveViaYtDlp };
