package com.ludus.gym.ui.screens.gym

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.ludus.gym.domain.model.GymRegistrationResult
import com.ludus.gym.ui.components.LudusButton
import com.ludus.gym.ui.components.LudusButtonVariant
import com.ludus.gym.ui.components.LudusCard
import com.ludus.gym.ui.theme.Emerald
import com.ludus.gym.ui.theme.Ignition
import com.ludus.gym.ui.theme.Ink
import com.ludus.gym.ui.theme.Muted
import com.ludus.gym.ui.theme.Volt

/** Alta pública de gimnasio: accesible sin sesión y sin gimnasio vinculado. */
@Composable
fun RegisterGymScreen(
    viewModel: RegisterGymViewModel,
    onBack: () -> Unit,
) {
    val focusManager: FocusManager = LocalFocusManager.current
    fun next() {
        focusManager.moveFocus(FocusDirection.Down)
    }

    fun done() {
        focusManager.clearFocus()
    }

    val result = viewModel.result

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            text = "Ludus.",
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Registrar un gimnasio",
            style = MaterialTheme.typography.headlineSmall,
            color = Ink,
        )
        Text(
            text = "Registro público. Tu gimnasio quedará pendiente de verificación y autorización.",
            style = MaterialTheme.typography.bodySmall,
            color = Muted,
        )

        if (result != null) {
            GymRegistrationSuccess(result = result, onBack = onBack)
        } else {
            LudusCard {
                Text("Datos del gimnasio", style = MaterialTheme.typography.titleMedium, color = Volt)
                Spacer(Modifier.height(12.dp))
                GymField("Nombre del gimnasio", viewModel.gymName, viewModel::onGymNameChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField("Identificador (opcional)", viewModel.slug, viewModel::onSlugChange, ::next)
            }

            LudusCard {
                Text("Dueño del gimnasio", style = MaterialTheme.typography.titleMedium, color = Volt)
                Spacer(Modifier.height(12.dp))
                GymField("Nombre del dueño", viewModel.ownerName, viewModel::onOwnerNameChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Correo del dueño",
                    value = viewModel.email,
                    onValueChange = viewModel::onEmailChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Email,
                )
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Contraseña (mínimo 12 caracteres)",
                    value = viewModel.password,
                    onValueChange = viewModel::onPasswordChange,
                    onNext = ::next,
                    password = true,
                    trailingIcon = {
                        TextButton(
                            onClick = viewModel::togglePasswordVisibility,
                            modifier = Modifier.heightIn(min = 48.dp),
                        ) {
                            Text(if (viewModel.passwordVisible) "Ocultar" else "Ver")
                        }
                    },
                )
            }

            LudusCard {
                Text("Contacto y ubicación", style = MaterialTheme.typography.titleMedium, color = Volt)
                Spacer(Modifier.height(12.dp))
                GymField(
                    label = "Correo de contacto",
                    value = viewModel.contactEmail,
                    onValueChange = viewModel::onContactEmailChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Email,
                )
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Teléfono",
                    value = viewModel.phone,
                    onValueChange = viewModel::onPhoneChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Phone,
                )
                Spacer(Modifier.height(10.dp))
                GymField("Dirección", viewModel.address, viewModel::onAddressChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField("Ciudad", viewModel.city, viewModel::onCityChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField("Estado", viewModel.state, viewModel::onStateChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField("Código postal", viewModel.postalCode, viewModel::onPostalCodeChange, ::next)
            }

            LudusCard {
                Text("Datos legales", style = MaterialTheme.typography.titleMedium, color = Volt)
                Spacer(Modifier.height(12.dp))
                GymField(
                    label = "Representante legal",
                    value = viewModel.legalRepresentative,
                    onValueChange = viewModel::onLegalRepresentativeChange,
                    onNext = ::next,
                )
                Spacer(Modifier.height(10.dp))
                GymField("RFC", viewModel.rfc, viewModel::onRfcChange, ::next)
            }

            LudusCard {
                Text("Información adicional (opcional)", style = MaterialTheme.typography.titleMedium, color = Volt)
                Spacer(Modifier.height(12.dp))
                GymField(
                    label = "Sitio web",
                    value = viewModel.website,
                    onValueChange = viewModel::onWebsiteChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Uri,
                )
                Spacer(Modifier.height(10.dp))
                GymField("Redes sociales", viewModel.socialMedia, viewModel::onSocialMediaChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField("Descripción", viewModel.description, viewModel::onDescriptionChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Número de sucursales",
                    value = viewModel.branchCount,
                    onValueChange = viewModel::onBranchCountChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Number,
                )
                Spacer(Modifier.height(10.dp))
                GymField("Zona horaria", viewModel.timezone, viewModel::onTimezoneChange, ::next)
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Capacidad",
                    value = viewModel.capacity,
                    onValueChange = viewModel::onCapacityChange,
                    onNext = ::next,
                    keyboardType = KeyboardType.Number,
                )
                Spacer(Modifier.height(10.dp))
                GymField(
                    label = "Horario de atención",
                    value = viewModel.openingHours,
                    onValueChange = viewModel::onOpeningHoursChange,
                    onNext = ::done,
                    onDone = ::done,
                    imeAction = ImeAction.Done,
                )
            }

            viewModel.errorMessage?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Ignition,
                )
            }

            LudusButton(
                text = if (viewModel.isLoading) "Enviando registro…" else "Enviar registro",
                onClick = {
                    focusManager.clearFocus()
                    viewModel.submit()
                },
                loading = viewModel.isLoading,
            )
            LudusButton(
                text = "Volver al inicio de sesión",
                onClick = onBack,
                variant = LudusButtonVariant.GHOST,
            )
        }
    }
}

@Composable
private fun GymField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    onNext: () -> Unit,
    onDone: () -> Unit = onNext,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    password: Boolean = false,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
        keyboardActions = KeyboardActions(onNext = { onNext() }, onDone = { onDone() }),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = trailingIcon,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun GymRegistrationSuccess(
    result: GymRegistrationResult,
    onBack: () -> Unit,
) {
    LudusCard {
        Text("Solicitud enviada", style = MaterialTheme.typography.headlineSmall, color = Emerald)
        Spacer(Modifier.height(10.dp))
        Text(
            text = "Registro recibido. Confirma tu correo y espera la autorización de un administrador.",
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
        )
        Spacer(Modifier.height(12.dp))
        Text("Gimnasio: ${result.gymName}", style = MaterialTheme.typography.bodySmall, color = Muted)
        result.slug?.let { Text("Identificador: $it", style = MaterialTheme.typography.bodySmall, color = Muted) }
        result.gymId.takeIf { it.isNotBlank() }?.let {
            Text("Folio: $it", style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        result.ownerEmail.takeIf { it.isNotBlank() }?.let {
            Text("Correo del dueño: $it", style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        result.verificationEmail?.let {
            Text("Confirmación enviada a: $it", style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        result.approvalEmail?.let {
            Text("Autorización enviada a: $it", style = MaterialTheme.typography.bodySmall, color = Muted)
        }

        val devLinks = listOfNotNull(
            result.verificationDevLink?.let { "Enlace de prueba (confirmación): $it" },
            result.approvalDevLink?.let { "Enlace de prueba (autorización): $it" },
        )
        val devTokens = listOfNotNull(
            result.verificationDevToken?.let { "Token de prueba (confirmación): $it" },
            result.approvalDevToken?.let { "Token de prueba (autorización): $it" },
        )
        if (devLinks.isNotEmpty() || devTokens.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("Atajos de desarrollo", style = MaterialTheme.typography.labelLarge, color = Volt)
            (devLinks + devTokens).forEach {
                Text(it, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }
    }
    LudusButton(
        text = "Volver al inicio de sesión",
        onClick = onBack,
        variant = LudusButtonVariant.SECONDARY,
    )
}
