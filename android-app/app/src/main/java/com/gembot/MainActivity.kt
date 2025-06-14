package com.gembot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import dagger.hilt.android.AndroidEntryPoint
import com.gembot.ui.GeMBotNavHost
import com.gembot.ui.theme.GeMBotTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GeMBotTheme {
                GeMBotNavHost()
            }
        }
    }
}
