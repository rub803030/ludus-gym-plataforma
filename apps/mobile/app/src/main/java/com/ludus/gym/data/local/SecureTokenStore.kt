package com.ludus.gym.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.ludus.gym.domain.model.Session
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

interface TokenProvider {
    fun currentAccessToken(): String?
    fun currentRefreshToken(): String?
    fun memberId(): String?
    fun saveTokens(accessToken: String, refreshToken: String, memberId: String)
    fun clearSession()
}

/**
 * Tokens y identificadores guardados cifrados con Android Keystore.
 * Nunca se usa SharedPreferences en texto plano para credenciales.
 */
class SecureTokenStore(context: Context) : TokenProvider {
    private val masterKey = MasterKey.Builder(context.applicationContext)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context.applicationContext,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _session = MutableStateFlow(readSession())
    val session: StateFlow<Session?> = _session.asStateFlow()

    init {
        if (prefs.getString(KEY_DEVICE_ID, null).isNullOrBlank()) {
            prefs.edit().putString(KEY_DEVICE_ID, UUID.randomUUID().toString()).apply()
        }
    }

    fun deviceId(): String {
        val stored = prefs.getString(KEY_DEVICE_ID, null)
        if (!stored.isNullOrBlank()) return stored
        val generated = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE_ID, generated).apply()
        return generated
    }

    fun hasSession(): Boolean = _session.value != null

    override fun currentAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    override fun currentRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    override fun memberId(): String? = prefs.getString(KEY_MEMBER_ID, null)

    override fun saveTokens(accessToken: String, refreshToken: String, memberId: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putString(KEY_MEMBER_ID, memberId)
            .apply()
        _session.value = Session(accessToken, refreshToken, memberId)
    }

    override fun clearSession() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_MEMBER_ID)
            .apply()
        _session.value = null
    }

    private fun readSession(): Session? {
        val access = prefs.getString(KEY_ACCESS_TOKEN, null)
        val refresh = prefs.getString(KEY_REFRESH_TOKEN, null)
        val id = prefs.getString(KEY_MEMBER_ID, null)
        return if (access.isNullOrBlank() || refresh.isNullOrBlank() || id.isNullOrBlank()) {
            null
        } else {
            Session(access, refresh, id)
        }
    }

    private companion object {
        const val PREFS_NAME = "ludus_secure_prefs"
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_MEMBER_ID = "member_id"
        const val KEY_DEVICE_ID = "device_id"
    }
}
