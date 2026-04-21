import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '../../lib/config.js';

const FALLBACK_NATIVE_API_ORIGIN = 'https://ferma-tolk.youridea.live';

export function getApiOrigin() {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (Capacitor.isNativePlatform()) {
    return FALLBACK_NATIVE_API_ORIGIN;
  }

  return '';
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getApiOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}
