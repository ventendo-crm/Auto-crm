package ru.importcrm.app

import android.webkit.JavascriptInterface

class WebAppBridge(
    private val onRefreshPolicyChanged: () -> Unit,
) {
    @Volatile
    var pageAtTop: Boolean = false
        private set

    @Volatile
    var horizontalGestureLock: Boolean = false
        private set

    @Volatile
    var pullToRefreshEnabled: Boolean = true
        private set

    fun canPullToRefresh(): Boolean = pullToRefreshEnabled && pageAtTop && !horizontalGestureLock

    @JavascriptInterface
    fun setPageAtTop(atTop: Boolean) {
        if (pageAtTop == atTop) {
            return
        }
        pageAtTop = atTop
        onRefreshPolicyChanged()
    }

    @JavascriptInterface
    fun setHorizontalGestureLock(locked: Boolean) {
        if (horizontalGestureLock == locked) {
            return
        }
        horizontalGestureLock = locked
        onRefreshPolicyChanged()
    }

    @JavascriptInterface
    fun setPullToRefreshEnabled(enabled: Boolean) {
        if (pullToRefreshEnabled == enabled) {
            return
        }
        pullToRefreshEnabled = enabled
        onRefreshPolicyChanged()
    }

    companion object {
        const val SCROLL_TRACKER_JS = """
            (function () {
              if (window.__importCrmScrollHook) {
                if (window.__importCrmReportScroll) window.__importCrmReportScroll();
                return;
              }
              window.__importCrmScrollHook = true;

              var scheduled = false;
              function computeAtTop() {
                if (window.scrollY > 1) return false;
                var nodes = document.querySelectorAll('[data-scroll-container], main, [class*="overflow-y-auto"], [class*="overflow-auto"]');
                for (var i = 0; i < nodes.length; i++) {
                  var el = nodes[i];
                  if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 1) {
                    return false;
                  }
                }
                return true;
              }

              function reportNow() {
                scheduled = false;
                if (window.ImportCrmAndroid && window.ImportCrmAndroid.setPageAtTop) {
                  window.ImportCrmAndroid.setPageAtTop(computeAtTop());
                }
              }

              function report() {
                if (scheduled) return;
                scheduled = true;
                window.requestAnimationFrame(reportNow);
              }

              window.__importCrmReportScroll = report;
              document.addEventListener('scroll', report, { capture: true, passive: true });
              window.addEventListener('resize', report, { passive: true });
              window.addEventListener('popstate', report);
              new MutationObserver(report).observe(document.body, {
                childList: true,
                subtree: true,
              });
              report();
            })();
        """
    }
}
