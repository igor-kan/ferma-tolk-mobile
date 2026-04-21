function toUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    return new URL(rawUrl);
  } catch {
    if (typeof window === 'undefined') return null;
    try {
      return new URL(rawUrl, window.location.origin);
    } catch {
      return null;
    }
  }
}

export function parseAuthCallbackUrl(rawUrl) {
  const url = toUrl(rawUrl);
  if (!url) return null;

  const hash = url.hash || '';
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const queryParams = url.searchParams;

  const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
  const callbackType = hashParams.get('type') || queryParams.get('type');

  const isRecovery =
    hash === '#recovery' || callbackType === 'recovery' || hash.includes('type=recovery');

  return {
    isRecovery,
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  };
}

export function isRecoveryCallbackUrl(rawUrl) {
  return Boolean(parseAuthCallbackUrl(rawUrl)?.isRecovery);
}
