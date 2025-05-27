package com.typetech.gembids

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.OkHttpClient
import okhttp3.Request

object SupabaseClient {
    private val client = OkHttpClient()
    private const val url = "https://nimtnjjaemptuywriwbn.supabase.co/rest/v1/live_bids"
    private const val key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pbXRuamphZW1wdHV5d3Jpd2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzM1OTksImV4cCI6MjA2Mzg0OTU5OX0.CXijiG0vQ361XlvzfNWhZqfMzeUGlnA5rxPeqCDcUKg"

    fun fetchBids(): List<Bid> {
        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", key)
            .addHeader("Authorization", "Bearer $key")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("Error: ${response.code}")
            val json = response.body?.string()
            val type = object : TypeToken<List<Bid>>() {}.type
            return Gson().fromJson(json, type)
        }
    }
}
