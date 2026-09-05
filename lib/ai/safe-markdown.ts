/** Protocol firewall shared by the Concierge renderer and its regression tests. */
export function safeConciergeUrl(url: string, allowedUrls?:readonly string[]): string {
  if (url.startsWith('/') && !url.startsWith('//')) return allowedUrls===undefined||allowedUrls.includes(url)?url:'';
  try {
    const parsed = new URL(url);
    if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')return '';
    if(allowedUrls===undefined)return parsed.toString();
    return allowedUrls.some(allowed=>{try{return new URL(allowed).toString()===parsed.toString()}catch{return false}})?parsed.toString():'';
  } catch {
    return '';
  }
}
