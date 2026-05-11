package com.homearcade.app.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.homearcade.app.data.UploadResult
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadScreen(
    navController: NavController,
    vm: UploadViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val context = LocalContext.current

    // File picker — accepts any file type (ROM formats vary widely)
    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val fileName = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                if (nameIdx >= 0) cursor.getString(nameIdx) else null
            } ?: uri.lastPathSegment ?: "rom"
            vm.selectFile(uri, fileName)
        }
    }

    // Show success snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.result) {
        if (state.result is UploadResult.Success) {
            val r = state.result as UploadResult.Success
            snackbarHostState.showSnackbar(
                message = "✓ \"${r.title}\" added to your library!",
                duration = SnackbarDuration.Short
            )
            vm.dismissResult()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Upload Game") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {

            // ── Step 1: Pick console ────────────────────────────────────────
            SectionLabel("1. Choose a console")
            SystemSelector(
                selected = state.selectedSystem,
                onSelect = vm::selectSystem,
                allowedSystems = state.uploadLimits?.allowedExtensions?.keys ?: SYSTEM_LABELS.keys
            )

            // ── Step 2: Pick file ───────────────────────────────────────────
            SectionLabel("2. Select a ROM file")
            FilePickerCard(
                fileName = state.selectedFileName,
                allowedExtensions = if (state.selectedSystem.isNotBlank())
                    state.uploadLimits?.allowedExtensions?.get(state.selectedSystem)
                else null,
                onClick = { filePicker.launch("*/*") }
            )

            // ── Upload progress ─────────────────────────────────────────────
            AnimatedVisibility(visible = state.uploading) {
                UploadProgressCard(
                    bytesSent = state.progressBytes,
                    totalBytes = state.totalBytes
                )
            }

            // ── Error message ───────────────────────────────────────────────
            AnimatedVisibility(visible = state.errorMessage != null) {
                state.errorMessage?.let { msg ->
                    ErrorCard(msg) { vm.dismissResult() }
                }
            }

            // ── Upload button ───────────────────────────────────────────────
            val canUpload = state.selectedUri != null &&
                    state.selectedSystem.isNotBlank() &&
                    !state.uploading

            Button(
                onClick = vm::startUpload,
                enabled = canUpload,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Filled.CloudUpload, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Upload ROM", style = MaterialTheme.typography.titleMedium)
            }

            // ── Server info note ────────────────────────────────────────────
            state.uploadLimits?.let {
                Text(
                    text = "Server limit: ${it.maxUploadMb} MB",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (state.limitsLoading) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Text("Contacting server…", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

// ── Sub-composables ──────────────────────────────────────────────────────────

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SystemSelector(
    selected: String,
    onSelect: (String) -> Unit,
    allowedSystems: Set<String>
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        for ((key, label) in SYSTEM_LABELS) {
            if (key !in allowedSystems) continue
            val isSelected = key == selected
            FilterChip(
                selected = isSelected,
                onClick = { onSelect(key) },
                label = { Text(label, maxLines = 1) },
                leadingIcon = if (isSelected) {{
                    Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                }} else null
            )
        }
    }
}

@Composable
private fun FilePickerCard(fileName: String, allowedExtensions: List<String>?, onClick: () -> Unit) {
    val hasFile = fileName.isNotBlank()
    Surface(
        shape = RoundedCornerShape(12.dp),
        tonalElevation = if (hasFile) 2.dp else 0.dp,
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (hasFile) 0.dp else 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                shape = RoundedCornerShape(12.dp)
            )
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = if (hasFile) Icons.Filled.InsertDriveFile else Icons.Filled.FolderOpen,
                contentDescription = null,
                tint = if (hasFile) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(32.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (hasFile) fileName else "Tap to browse files",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (hasFile) FontWeight.Medium else FontWeight.Normal,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (!hasFile && allowedExtensions != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = allowedExtensions.joinToString(" "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (hasFile) {
                Icon(
                    Icons.Filled.Edit,
                    contentDescription = "Change file",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun UploadProgressCard(bytesSent: Long, totalBytes: Long) {
    val progressFraction = if (totalBytes > 0) (bytesSent.toFloat() / totalBytes).coerceIn(0f, 1f) else -1f
    val percentLabel = if (progressFraction >= 0f) "${(progressFraction * 100).roundToInt()}%" else "Uploading…"

    Surface(
        shape = RoundedCornerShape(12.dp),
        tonalElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.5.dp)
                    Text("Uploading…", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                }
                Text(percentLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
            if (progressFraction >= 0f) {
                LinearProgressIndicator(
                    progress = { progressFraction },
                    modifier = Modifier.fillMaxWidth(),
                    trackColor = MaterialTheme.colorScheme.primaryContainer
                )
                if (totalBytes > 0) {
                    Text(
                        text = "${formatBytes(bytesSent)} / ${formatBytes(totalBytes)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    trackColor = MaterialTheme.colorScheme.primaryContainer
                )
            }
        }
    }
}

@Composable
private fun ErrorCard(message: String, onDismiss: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                Icons.Filled.Error,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(20.dp).padding(top = 1.dp)
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss, modifier = Modifier.size(20.dp)) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Dismiss",
                    tint = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

private fun formatBytes(bytes: Long): String {
    return when {
        bytes < 1024L         -> "${bytes} B"
        bytes < 1024L * 1024  -> "${bytes / 1024} KB"
        bytes < 1024L * 1024 * 1024 -> "${ "%.1f".format(bytes / (1024.0 * 1024)) } MB"
        else -> "${ "%.2f".format(bytes / (1024.0 * 1024 * 1024)) } GB"
    }
}
