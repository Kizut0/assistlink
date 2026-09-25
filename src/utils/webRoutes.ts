// Only known, local pages may be used as a post-login destination.
export function safeWebReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === '/assistlink' || value === '/assistlink/') return '/assistlink/';
  if (/^\/assistlink\/(?:opportunities(?:\/[1-9]\d*)?|profile|applications|manage|users)\/?$/.test(value)) {
    return value.endsWith('/') ? value : `${value}/`;
  }
  return undefined;
}
