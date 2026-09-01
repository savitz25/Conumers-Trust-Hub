/** Protocol firewall shared by the Concierge renderer and its regression tests. */
export function safeConciergeUrl(url: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}
