package com.gembot.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(onNavigateToEdit: (String) -> Unit) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text("Live Bids", style = MaterialTheme.typography.headlineSmall)

        Spacer(Modifier.height(16.dp))

        listOf("GEM/2025/B/123456", "GEM/2025/B/654321").forEach { bid ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clickable { onNavigateToEdit(bid) }
            ) {
                Text(
                    text = bid,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }
    }
}
