package com.ludus.gym.data.remote

import com.ludus.gym.data.local.TokenProvider
import okhttp3.Interceptor
import okhttp3.Response

/** Añade el Bearer token a todas las peticiones autenticadas. */
class AuthInterceptor(private val tokens: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokens.currentAccessToken()
        val request = if (token.isNullOrBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        }
        return chain.proceed(request)
    }
}
