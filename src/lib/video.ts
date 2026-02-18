const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];

function parseUrl(rawUrl?: string | null): URL | null {
    if (!rawUrl) return null;

    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed);
    } catch {
        return null;
    }
}

function normalizeHost(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, '');
}

function extractYouTubeId(url: URL): string | null {
    const host = normalizeHost(url.hostname);
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be') {
        return parts[0] || null;
    }

    if (parts[0] === 'watch') {
        return url.searchParams.get('v');
    }

    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
        return parts[1] || null;
    }

    return null;
}

function extractVimeoId(url: URL): string | null {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    const numericPart = [...parts].reverse().find(part => /^\d+$/.test(part));
    return numericPart || null;
}

export function getEmbedVideoUrl(rawUrl?: string | null): string | null {
    const url = parseUrl(rawUrl);
    if (!url) return null;

    const host = normalizeHost(url.hostname);

    if (
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtu.be'
    ) {
        const id = extractYouTubeId(url);
        if (!id) return null;
        return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const id = extractVimeoId(url);
        if (!id) return null;
        return `https://player.vimeo.com/video/${id}`;
    }

    return null;
}

export function isDirectVideoFile(rawUrl?: string | null): boolean {
    const url = parseUrl(rawUrl);
    if (!url) return false;

    const pathname = url.pathname.toLowerCase();
    return DIRECT_VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
}
