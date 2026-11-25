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
    fun activeGymId(): String?
    val activeGym: StateFlow<String?>
    fun saveTokens(
        accessToken: String,
        refreshToken: String,
        memberId: String,
        activeGymId: String? = null,
    )
    fun saveActiveGymId(gymId: String?)
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

    private val _activeGym = MutableStateFlow(prefs.getString(KEY_ACTIVE_GYM_ID, null))
    override val activeGym: StateFlow<String?> = _activeGym.asStateFlow()

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

    /** El gimnasio activo se conserva al renovar el token; solo se cambia al vincular o cambiar de gimnasio. */
    override fun activeGymId(): String? = prefs.getString(KEY_ACTIVE_GYM_ID, null)

    override fun saveTokens(
        accessToken: String,
        refreshToken: String,
        memberId: String,
        activeGymId: String?,
    ) {
        val gymId = activeGymId ?: activeGymId()
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putString(KEY_MEMBER_ID, memberId)
            .apply()
        if (gymId != null) prefs.edit().putString(KEY_ACTIVE_GYM_ID, gymId).apply()
        _activeGym.value = gymId
        _session.value = Session(accessToken, refreshToken, memberId, gymId)
    }

    override fun saveActiveGymId(gymId: String?) {
        val editor = prefs.edit()
        if (gymId.isNullOrBlank()) editor.remove(KEY_ACTIVE_GYM_ID) else editor.putString(KEY_ACTIVE_GYM_ID, gymId)
        editor.apply()
        _activeGym.value = gymId?.takeIf { it.isNotBlank() }
        _session.value = _session.value?.copy(activeGymId = _activeGym.value)
    }

    override fun clearSession() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_MEMBER_ID)
            .remove(KEY_ACTIVE_GYM_ID)
            .apply()
        _activeGym.value = null
        _session.value = null
    }

    private fun readSession(): Session? {
        val access = prefs.getString(KEY_ACCESS_TOKEN, null)
        val refresh = prefs.getString(KEY_REFRESH_TOKEN, null)
        val id = prefs.getString(KEY_MEMBER_ID, null)
        return if (access.isNullOrBlank() || refresh.isNullOrBlank() || id.isNullOrBlank()) {
            null
        } else {
            Session(access, refresh, id, prefs.getString(KEY_ACTIVE_GYM_ID, null))
        }
    }

    private companion object {
        const val PREFS_NAME = "ludus_secure_prefs"
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_MEMBER_ID = "member_id"
        const val KEY_ACTIVE_GYM_ID = "active_gym_id"
        const val KEY_DEVICE_ID = "device_id"
    }
}
