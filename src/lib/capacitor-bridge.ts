import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { ThemeMode } from '../types';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function initNativeBridge(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    // Ignore if keyboard plugin is unavailable
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Ignore if status bar overlay config fails
  }
}

export async function syncNativeSystemBars(theme: ThemeMode): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (theme === 'dark') {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#060911' });
    } else {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#f8fafc' });
    }
  } catch {
    // Ignore status bar errors in non-native environments
  }
}

export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 220 });
  } catch {
    // Ignore splash hide errors
  }
}

export function registerAndroidBackHandler(handleBack: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let removed = false;
  let listenerHandle: { remove: () => Promise<void> } | null = null;

  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const consumed = handleBack();
    if (consumed) return;

    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      void CapacitorApp.minimizeApp();
    }
  }).then((handle) => {
    if (removed) {
      void handle.remove();
    } else {
      listenerHandle = handle;
    }
  });

  return () => {
    removed = true;
    if (listenerHandle) {
      void listenerHandle.remove();
      listenerHandle = null;
    }
  };
}
