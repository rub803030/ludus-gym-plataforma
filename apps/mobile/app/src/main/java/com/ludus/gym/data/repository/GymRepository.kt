package com.ludus.gym.data.repository

import com.ludus.gym.data.local.ActiveGymEntity
import com.ludus.gym.data.local.GymEntity
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.TokenProvider
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.dto.JoinGymRequestDto
import com.ludus.gym.data.remote.dto.SwitchGymRequestDto
import com.ludus.gym.data.remote.dto.toDomain
import com.ludus.gym.domain.model.Gym
import com.ludus.gym.domain.model.JoinResult
import com.ludus.gym.domain.model.MyGyms
import com.ludus.gym.domain.model.SwitchResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map

interface GymRepository {
    val activeGymId: StateFlow<String?>
    fun observeGyms(): Flow<List<Gym>>
    suspend fun joinGym(code: String): Result<JoinResult>
    suspend fun refreshMyGyms(): Result<MyGyms>
    suspend fun switchGym(gymId: String): Result<SwitchResult>
}

class DefaultGymRepository(
    private val api: ApiService,
    private val tokens: TokenProvider,
    private val dao: LudusDao,
) : GymRepository {

    override val activeGymId: StateFlow<String?> = tokens.activeGym

    override fun observeGyms(): Flow<List<Gym>> = dao.observeGyms().map { entities ->
        entities.map { entity ->
            Gym(
                id = entity.id,
                name = entity.name,
                publicCode = entity.publicCode,
                status = entity.status,
            )
        }
    }

    override suspend fun joinGym(code: String): Result<JoinResult> = runCatching {
        val response = api.joinGym(JoinGymRequestDto(code.trim()))
        val result = response.toDomain()
        applyActiveGym(result.activeGymId, response.tokens?.accessToken, response.tokens?.refreshToken)
        cacheGym(result.gym)
        result
    }

    override suspend fun refreshMyGyms(): Result<MyGyms> = runCatching {
        val result = api.myGyms().toDomain()
        dao.saveGyms(
            result.gyms.map { gym ->
                GymEntity(
                    id = gym.id,
                    name = gym.name,
                    publicCode = gym.publicCode,
                    status = gym.status,
                    cachedAt = System.currentTimeMillis(),
                )
            },
        )
        tokens.saveActiveGymId(result.activeGymId)
        result.gyms.firstOrNull { it.id == result.activeGymId }?.let { gym ->
            cacheGym(Gym(gym.id, gym.name, gym.publicCode, gym.status))
        }
        result
    }

    override suspend fun switchGym(gymId: String): Result<SwitchResult> = runCatching {
        val response = api.switchGym(SwitchGymRequestDto(gymId))
        val result = response.toDomain()
        applyActiveGym(result.activeGymId, response.tokens?.accessToken, response.tokens?.refreshToken)
        cacheGym(result.gym)
        result
    }

    private fun applyActiveGym(gymId: String, accessToken: String?, refreshToken: String?) {
        val access = accessToken?.takeIf { it.isNotBlank() }
        val refresh = refreshToken?.takeIf { it.isNotBlank() }
        if (access != null && refresh != null) {
            // El JWT devuelto ya trae activeGymId: guardarlo evita fallos de NO_GYM.
            tokens.saveTokens(access, refresh, tokens.memberId().orEmpty(), gymId)
        } else {
            tokens.saveActiveGymId(gymId)
        }
    }

    private suspend fun cacheGym(gym: Gym) {
        dao.saveGyms(
            listOf(
                GymEntity(
                    id = gym.id,
                    name = gym.name,
                    publicCode = gym.publicCode,
                    status = gym.status,
                    cachedAt = System.currentTimeMillis(),
                ),
            ),
        )
        dao.saveActiveGym(ActiveGymEntity(gymId = gym.id))
    }
}
