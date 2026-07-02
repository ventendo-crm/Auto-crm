package ru.importcrm.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var errorView: View
    private lateinit var errorText: TextView
    private lateinit var retryButton: Button

    private lateinit var webAppBridge: WebAppBridge

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val backPressedCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }
    }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                registerFcmToken()
            }
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            filePathCallback = null

            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            callback.onReceiveValue(uris)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        errorView = findViewById(R.id.errorView)
        errorText = findViewById(R.id.errorText)
        retryButton = findViewById(R.id.retryButton)

        webAppBridge = WebAppBridge { updateSwipeRefreshState() }
        webView.addJavascriptInterface(webAppBridge, "ImportCrmAndroid")

        applyWindowInsets()
        configureWebView()
        configureSwipeRefresh()
        retryButton.setOnClickListener { reloadSite() }

        onBackPressedDispatcher.addCallback(this, backPressedCallback)

        requestNotificationPermission()
        registerFcmToken()

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            openInitialUrl(intent)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openInitialUrl(intent)
    }

    override fun onResume() {
        super.onResume()
        PushRegistrar.syncIfLoggedIn(this)
        injectScrollTracker()
    }

    private fun applyWindowInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            windowInsets
        }
        ViewCompat.requestApplyInsets(swipeRefresh)
    }

    private fun configureSwipeRefresh() {
        swipeRefresh.setColorSchemeResources(R.color.brand)
        swipeRefresh.isEnabled = false
        swipeRefresh.setOnRefreshListener {
            if (webAppBridge.canPullToRefresh()) {
                webView.reload()
            } else {
                swipeRefresh.isRefreshing = false
            }
        }
        swipeRefresh.setOnChildScrollUpCallback { _, _ ->
            !webAppBridge.canPullToRefresh()
        }
    }

    private fun updateSwipeRefreshState() {
        swipeRefresh.isEnabled = webAppBridge.canPullToRefresh()
        if (!webAppBridge.canPullToRefresh()) {
            swipeRefresh.isRefreshing = false
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = if (isOnline()) {
                WebSettings.LOAD_DEFAULT
            } else {
                WebSettings.LOAD_CACHE_ELSE_NETWORK
            }
            loadsImagesAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = userAgentString + AppConfig.USER_AGENT_SUFFIX
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith(AppConfig.BASE_URL)) {
                    false
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                swipeRefresh.isRefreshing = false
                updateBackNavigationState()
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                updateBackNavigationState()
            }

            override fun onPageFinished(view: WebView, url: String?) {
                swipeRefresh.isRefreshing = false
                errorView.isVisible = false
                webView.isVisible = true
                updateBackNavigationState()
                injectScrollTracker()
                PushRegistrar.syncIfLoggedIn(this@MainActivity)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (!request.isForMainFrame) {
                    return
                }
                showError(getString(R.string.error_loading))
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams.createIntent()
                fileChooserLauncher.launch(Intent.createChooser(intent, getString(R.string.choose_file)))
                return true
            }
        }
    }

    private fun injectScrollTracker() {
        if (!webView.url.orEmpty().startsWith(AppConfig.BASE_URL)) {
            return
        }
        webView.evaluateJavascript(WebAppBridge.SCROLL_TRACKER_JS, null)
    }

    private fun updateBackNavigationState() {
        backPressedCallback.isEnabled = webView.canGoBack()
    }

    private fun openInitialUrl(intent: Intent?) {
        val deepLink = intent?.getStringExtra(EXTRA_TARGET_URL)
        val path = deepLink?.takeIf { it.isNotBlank() } ?: "/"
        val target = if (path.startsWith("http")) path else "${AppConfig.BASE_URL}$path"

        if (!isOnline()) {
            showError(getString(R.string.error_offline))
            webView.loadUrl(target)
            return
        }

        errorView.isVisible = false
        webView.isVisible = true
        webView.loadUrl(target)
    }

    private fun reloadSite() {
        if (!isOnline()) {
            showError(getString(R.string.error_offline))
            return
        }
        errorView.isVisible = false
        webView.isVisible = true
        webView.reload()
    }

    private fun showError(message: String) {
        swipeRefresh.isRefreshing = false
        errorText.text = message
        errorView.isVisible = true
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            PushRegistrar.saveToken(this, token)
        }
    }

    companion object {
        const val EXTRA_TARGET_URL = "target_url"
    }
}
