package com.homearcade.app.ui.screens

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.homearcade.app.data.RomUploadRepository
import com.homearcade.app.data.SettingsRepository
import com.homearcade.app.data.UploadLimits
import com.homearcade.app.data.UploadResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class UploadUiState(
    val selectedUri: Uri? = null,
    val selectedFileName: String = "",
    val selectedSystem: String = "",
    val uploadLimits: UploadLimits? = null,
    val limitsLoading: Boolean = false,
    val uploading: Boolean = false,
    val progressBytes: Long = 0L,
    val totalBytes: Long = -1L,
    val result: UploadResult? = null,
    val errorMessage: String? = null,
)

val SYSTEM_LABELS = linkedMapOf(
    "nes"       to "NES",
    "snes"      to "SNES",
    "n64"       to "Nintendo 64",
    "gba"       to "Game Boy Advance",
    "gb"        to "Game Boy",
    "gbc"       to "Game Boy Color",
    "nds"       to "Nintendo DS",
    "genesis"   to "Sega Genesis",
    "dreamcast" to "Dreamcast",
    "ps1"       to "PlayStation",
    "ps2"       to "PlayStation 2",
    "psp"       to "PSP",
    "arcade"    to "Arcade (MAME)",
)

class UploadViewModel(app: Application) : AndroidViewModel(app) {

    private val settingsRepo = SettingsRepository(app)
    private val uploadRepo   = RomUploadRepository(app)

    private val _state = MutableStateFlow(UploadUiState())
    val state: StateFlow<UploadUiState> = _state.asStateFlow()

    init {
        loadLimits()
    }

    fun loadLimits() {
        viewModelScope.launch {
            _state.value = _state.value.copy(limitsLoading = true)
            val url = settingsRepo.serverUrl.first()
            val limits = uploadRepo.fetchUploadLimits(url)
            _state.value = _state.value.copy(limitsLoading = false, uploadLimits = limits)
        }
    }

    fun selectFile(uri: Uri, fileName: String) {
        _state.value = _state.value.copy(
            selectedUri = uri,
            selectedFileName = fileName,
            result = null,
            errorMessage = null,
            progressBytes = 0L,
            totalBytes = -1L,
        )
    }

    fun selectSystem(system: String) {
        _state.value = _state.value.copy(selectedSystem = system, result = null, errorMessage = null)
    }

    fun dismissResult() {
        _state.value = _state.value.copy(result = null, errorMessage = null)
    }

    fun startUpload() {
        val st = _state.value
        val uri = st.selectedUri ?: return
        val system = st.selectedSystem.takeIf { it.isNotBlank() } ?: return

        viewModelScope.launch {
            val url = settingsRepo.serverUrl.first()
            _state.value = _state.value.copy(
                uploading = true,
                progressBytes = 0L,
                result = null,
                errorMessage = null
            )

            val result = uploadRepo.uploadRom(
                baseUrl = url,
                uri = uri,
                fileName = st.selectedFileName,
                system = system,
                onProgress = { sent, total ->
                    _state.value = _state.value.copy(progressBytes = sent, totalBytes = total)
                }
            )

            _state.value = _state.value.copy(
                uploading = false,
                result = result,
                errorMessage = if (result is UploadResult.Error) result.message else null,
                // Reset file selection on success so the user can upload another
                selectedUri = if (result is UploadResult.Success) null else uri,
                selectedFileName = if (result is UploadResult.Success) "" else st.selectedFileName,
            )
        }
    }
}
