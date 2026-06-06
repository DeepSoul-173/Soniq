const SPONSORBLOCK_API = 'https://sponsor.ajay.app/api/skipSegments';

// Segment categories we want to auto-skip in music playback.
const SKIP_CATEGORIES = ['music_offtopic', 'intro', 'outro'];

type SBSegment = {
  segment: [number, number];
  category: string;
};

export class SponsorBlock {
  static async getSegments(videoId: string): Promise<Array<[number, number]>> {
    if (!videoId) return [];

    const params = new URLSearchParams({
      videoID: videoId,
      categories: JSON.stringify(SKIP_CATEGORIES),
    });

    try {
      const response = await fetch(`${SPONSORBLOCK_API}?${params.toString()}`);
      if (response.status === 404) return []; // no segments for this video
      if (!response.ok) return [];

      const data: SBSegment[] = await response.json();
      return Array.isArray(data) ? data.map((s) => s.segment) : [];
    } catch {
      return [];
    }
  }
}
