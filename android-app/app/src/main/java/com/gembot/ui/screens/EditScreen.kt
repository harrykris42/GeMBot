package com.gembot.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun EditScreen(bidId: String) {
    Column(modifier = Modifier
        .fillMaxSize()
        .padding(16.dp)) {
        Text("Editing CSV for:", style = MaterialTheme.typography.headlineSmall)
        Text(bidId, style = MaterialTheme.typography.bodyLarge)

        Spacer(Modifier.height(24.dp))

        // CSV editing UI will go here
        Text("CSV Editor Coming Soon", style = MaterialTheme.typography.bodyMedium)
    }
}
