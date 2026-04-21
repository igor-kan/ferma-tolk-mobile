import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Mobile runtime bootstrap for Capacitor hosts.
 * Safe to call on web — it exits early when not on native platforms.
 */
export async function initMobileRuntime() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  document.documentElement.classList.add('native-shell');

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#064e3b' });
  } catch {
    // No-op when running on unsupported host
  }

  try {
    await Keyboard.setResizeMode({ mode: 'none' });
  } catch {
    // No-op when running on unsupported host
  }

  let lastBackPress = 0;

  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }

    const now = Date.now();
    if (now - lastBackPress < 1200) {
      CapacitorApp.exitApp();
      return;
    }

    lastBackPress = now;
    alert('Press back again to exit');
  });
}
