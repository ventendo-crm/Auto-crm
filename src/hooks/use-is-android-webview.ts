"use client";

import { useEffect, useState } from "react";
import { isAndroidWebView } from "@/lib/android-webview";

export function useIsAndroidWebView() {
  const [isAndroidApp, setIsAndroidApp] = useState(false);

  useEffect(() => {
    setIsAndroidApp(isAndroidWebView());
  }, []);

  return isAndroidApp;
}
