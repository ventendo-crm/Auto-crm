package ru.importcrm.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import android.webkit.CookieManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object PushRegistrar {
    private const val TAG = "PushRegistrar"
    private const val PREFS = "importcrm_prefs"
    private const val KEY_FCM = "fcm_token"

    fun saveToken(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FCM, token)
            .apply()
        syncIfLoggedIn(context)
    }

    fun getToken(context: Context): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_FCM, null)
    }

    fun syncIfLoggedIn(context: Context) {
        val token = getToken(context) ?: return
        val cookie = CookieManager.getInstance().getCookie(AppConfig.BASE_URL) ?: return
        if (!cookie.contains("auth-token=")) {
            return
        }

        Thread {
            try {
                val connection = (URL("${AppConfig.BASE_URL}/api/push/fcm/subscribe").openConnection()
                    as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Cookie", cookie)
                    setRequestProperty("User-Agent", "ImportCrmAndroid/1.0")
                    doOutput = true
                    connectTimeout = 15_000
                    readTimeout = 15_000
                }

                val body = JSONObject()
                    .put("token", token)
                    .put("label", "Android ${Build.MANUFACTURER} ${Build.MODEL}")
                    .toString()

                connection.outputStream.use { stream ->
                    stream.write(body.toByteArray(Charsets.UTF_8))
                }

                val code = connection.responseCode
                if (code !in 200..299) {
                    Log.w(TAG, "FCM sync failed with HTTP $code")
                }
            } catch (error: Exception) {
                Log.e(TAG, "FCM sync error: ${error.message}")
            }
        }.start()
    }
}
