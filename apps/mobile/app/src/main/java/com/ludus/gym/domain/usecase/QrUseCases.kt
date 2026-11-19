package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.QrRepository
import com.ludus.gym.domain.model.QrTicket

class ObserveQrUseCase(private val qr: QrRepository) {
    operator fun invoke() = qr.ticket
}

class GetQrUseCase(private val qr: QrRepository) {
    suspend operator fun invoke(): Result<QrTicket> = qr.refresh()
}

class VerifyQrLocallyUseCase(private val qr: QrRepository) {
    operator fun invoke(payload: String): Boolean = qr.verifyLocally(payload)
}

class RecordAccessUseCase(private val qr: QrRepository) {
    suspend operator fun invoke(token: String) = qr.recordAccessScan(token)
}
