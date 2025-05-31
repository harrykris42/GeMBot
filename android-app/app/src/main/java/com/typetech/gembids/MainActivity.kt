package com.typetech.gembids

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Surface
import androidx.compose.material.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    BidList()
                }
            }
        }
    }

    @Composable
    fun BidList() {
        var bids by remember { mutableStateOf<List<Bid>>(emptyList()) }

        LaunchedEffect(Unit) {
            withContext(Dispatchers.IO) {
                try {
                    val result = SupabaseClient.fetchBids()
                    withContext(Dispatchers.Main) {
                        bids = result
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        LazyColumn(modifier = Modifier.padding(16.dp)) {
            items(bids) { bid ->
                Column(modifier = Modifier
                    .padding(12.dp)
                    .fillMaxWidth()
                ) {
                    Text("📌 Bid No: ${bid.bid_no}", style = MaterialTheme.typography.h6)
                    Text("🕒 Start: ${bid.start_date}")
                    Text("🕓 End: ${bid.end_date}")
                    Text(
                        "🔗 View BOQ",
                        modifier = Modifier.clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(bid.boq))
                            startActivity(intent)
                        },
                        color = MaterialTheme.colors.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}
