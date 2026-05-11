package com.homearcade.app.data

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import java.io.IOException
import java.util.concurrent.TimeUnit

data class UploadLimits(
    val maxUploadMb: Int,
    val allowedExtensions: Map<String, List<String>>
)

sealed class UploadResult {
    data class Success(val title: String, val system: String, val id: Int) : UploadResult()
    data class Error(val message: String) : UploadResult()
}

class RomUploadRepository(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(0, TimeUnit.SECONDS) // streaming upload — no write timeout
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Fetch the server's allowed extensions and max upload size.
     */
    suspend fun fetchUploadLimits(baseUrl: String): UploadLimits? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url("$baseUrl/api/upload-limits").get().build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string() ?: return@withContext null
                parseUploadLimits(body)
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Upload a ROM file to the server.
     * [onProgress] is called with bytes sent and total bytes (total = -1 if unknown).
     */
    suspend fun uploadRom(
        baseUrl: String,
        uri: Uri,
        fileName: String,
        system: String,
        onProgress: (sent: Long, total: Long) -> Unit
    ): UploadResult = withContext(Dispatchers.IO) {
        val cr = context.contentResolver
        val totalBytes = try {
            cr.openFileDescriptor(uri, "r")?.use { it.statSize } ?: -1L
        } catch (e: Exception) { -1L }

        val body = object : RequestBody() {
            override fun contentType() = "application/octet-stream".toMediaType()
            override fun contentLength() = totalBytes
            override fun writeTo(sink: BufferedSink) {
                cr.openInputStream(uri)?.use { stream ->
                    val source = stream.source()
                    val buf = okio.Buffer()
                    var sent = 0L
                    var read: Long
                    while (source.read(buf, 8192L).also { read = it } != -1L) {
                        sink.write(buf, read)
                        sent += read
                        onProgress(sent, totalBytes)
                    }
                } ?: throw IOException("Cannot open file")
            }
        }

        val encodedName = java.net.URLEncoder.encode(fileName, "UTF-8")
        val url = "$baseUrl/api/roms/upload?system=${system.lowercase()}"

        val request = Request.Builder()
            .url(url)
            .addHeader("X-Rom-Filename", encodedName)
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val responseBody = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val title = extractJsonString(responseBody, "title") ?: fileName
                    val sysReturned = extractJsonString(responseBody, "system") ?: system
                    val id = extractJsonInt(responseBody, "id") ?: 0
                    UploadResult.Success(title, sysReturned, id)
                } else {
                    val msg = extractJsonString(responseBody, "message") ?: "Upload failed (${response.code})"
                    UploadResult.Error(msg)
                }
            }
        } catch (e: IOException) {
            UploadResult.Error("Network error: ${e.message}")
        } catch (e: Exception) {
            UploadResult.Error("Unexpected error: ${e.message}")
        }
    }

    // ── Minimal JSON helpers (no extra deps) ────────────────────────────────

    private fun parseUploadLimits(json: String): UploadLimits? {
        return try {
            val maxMb = extractJsonInt(json, "maxUploadMb") ?: 2048
            val extBlock = extractJsonObject(json, "allowedExtensions") ?: return null
            val systems = mutableMapOf<String, List<String>>()
            val systemKeys = listOf(
                "nes","snes","n64","gba","genesis","ps1","ps2",
                "arcade","dreamcast","gb","gbc","nds","psp"
            )
            for (key in systemKeys) {
                val array = extractJsonArray(extBlock, key)
                if (array != null) systems[key] = array
            }
            UploadLimits(maxMb, systems)
        } catch (e: Exception) { null }
    }

    private fun extractJsonString(json: String, key: String): String? {
        val pattern = Regex("\"$key\"\\s*:\\s*\"((?:[^\\\\\"]|\\\\.)*)\"")
        return pattern.find(json)?.groupValues?.get(1)
    }

    private fun extractJsonInt(json: String, key: String): Int? {
        val pattern = Regex("\"$key\"\\s*:\\s*(-?\\d+)")
        return pattern.find(json)?.groupValues?.get(1)?.toIntOrNull()
    }

    private fun extractJsonObject(json: String, key: String): String? {
        val idx = json.indexOf("\"$key\"")
        if (idx < 0) return null
        val colon = json.indexOf(':', idx)
        if (colon < 0) return null
        val start = json.indexOf('{', colon)
        if (start < 0) return null
        var depth = 0
        for (i in start until json.length) {
            when (json[i]) {
                '{' -> depth++
                '}' -> { depth--; if (depth == 0) return json.substring(start, i + 1) }
            }
        }
        return null
    }

    private fun extractJsonArray(json: String, key: String): List<String>? {
        val idx = json.indexOf("\"$key\"")
        if (idx < 0) return null
        val colon = json.indexOf(':', idx)
        if (colon < 0) return null
        val start = json.indexOf('[', colon)
        if (start < 0) return null
        val end = json.indexOf(']', start)
        if (end < 0) return null
        val inner = json.substring(start + 1, end)
        return Regex("\"([^\"]+)\"").findAll(inner).map { it.groupValues[1] }.toList()
    }
}
