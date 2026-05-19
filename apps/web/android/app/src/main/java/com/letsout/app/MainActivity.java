package com.letsout.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge: app draws behind status bar and navigation bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
