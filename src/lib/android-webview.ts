declare global {
  interface Window {
    ImportCrmAndroid?: {
      setPageAtTop?: (atTop: boolean) => void;
      setHorizontalGestureLock?: (locked: boolean) => void;
      setPullToRefreshEnabled?: (enabled: boolean) => void;
    };
  }
}

export function isAndroidWebView(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("ImportCrmAndroid");
}

export const androidBridge = {
  setHorizontalGestureLock(locked: boolean) {
    window.ImportCrmAndroid?.setHorizontalGestureLock?.(locked);
  },
  setPullToRefreshEnabled(enabled: boolean) {
    window.ImportCrmAndroid?.setPullToRefreshEnabled?.(enabled);
  },
};
