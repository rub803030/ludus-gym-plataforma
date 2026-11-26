package com.ludus.gym.ui.screens.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.ludus.gym.di.AppContainer
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.model.RegistrationResult

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoggedIn: (Member) -> Unit,
    onRegister: () -> Unit,
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Ludus.",
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Acceso de socios",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            text = "Solo socios activos. El equipo opera desde la consola web.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )

        Spacer(Modifier.height(28.dp))

        OutlinedTextField(
            value = viewModel.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text("Correo") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = viewModel.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("Contraseña") },
            singleLine = true,
            visualTransformation = if (viewModel.passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                TextButton(onClick = viewModel::togglePasswordVisibility) {
                    Text(if (viewModel.passwordVisible) "Ocultar" else "Ver")
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { viewModel.submit(onLoggedIn) },
            enabled = !viewModel.isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (viewModel.isLoading) "Validando…" else "Entrar")
        }

        viewModel.verificationMessage?.takeIf { viewModel.verificationDone && !viewModel.verificationRequired }?.let {
            StatusText(it, success = true)
        }
        viewModel.errorMessage?.takeIf { !viewModel.verificationRequired }?.let { StatusText(it) }

        TextButton(onClick = onRegister, modifier = Modifier.fillMaxWidth()) {
            Text("Crear cuenta")
        }

        TextButton(
            onClick = {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("${AppContainer.WEB_APP_URL}/privacidad"))
                )
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Política de privacidad")
        }

        if (viewModel.verificationRequired) {
            VerificationPanel(viewModel = viewModel)
        }
    }
}

@Composable
fun RegisterScreen(
    viewModel: RegisterViewModel,
    onRegistered: (RegistrationResult) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Ludus.", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
        Text(
            "Crear cuenta de socio",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            "Después de confirmar tu correo podrás vincular tu gimnasio.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )

        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = viewModel.firstName,
            onValueChange = viewModel::onFirstNameChange,
            label = { Text("Nombre") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.lastName,
            onValueChange = viewModel::onLastNameChange,
            label = { Text("Apellidos") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text("Correo") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("Contraseña (mínimo 12 caracteres)") },
            singleLine = true,
            visualTransformation = if (viewModel.passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                TextButton(onClick = viewModel::togglePasswordVisibility) {
                    Text(if (viewModel.passwordVisible) "Ocultar" else "Ver")
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.phone,
            onValueChange = viewModel::onPhoneChange,
            label = { Text("Teléfono (opcional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.documentNumber,
            onValueChange = viewModel::onDocumentNumberChange,
            label = { Text("Documento (opcional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = viewModel.birthDate,
            onValueChange = viewModel::onBirthDateChange,
            label = { Text("Nacimiento AAAA-MM-DD (opcional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(18.dp))
        Button(
            onClick = { viewModel.submit(onRegistered) },
            enabled = !viewModel.isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (viewModel.isLoading) "Creando cuenta…" else "Crear cuenta")
        }
        viewModel.errorMessage?.let { StatusText(it) }
        TextButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("Volver al inicio de sesión")
        }
        TextButton(
            onClick = {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("${AppContainer.WEB_APP_URL}/privacidad"))
                )
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Política de privacidad")
        }
    }
}

@Composable
fun VerifyEmailScreen(
    viewModel: LoginViewModel,
    token: String?,
    onBack: () -> Unit,
    onVerified: () -> Unit = onBack,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Ludus.", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
        Text(
            "Verificación de correo",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(top = 12.dp),
        )
        Spacer(Modifier.height(24.dp))
        VerificationPanel(viewModel = viewModel, token = token)
        Spacer(Modifier.height(12.dp))
        if (viewModel.verificationDone) {
            Button(onClick = onVerified, modifier = Modifier.fillMaxWidth()) {
                Text("Ir a iniciar sesión")
            }
        }
        TextButton(onClick = onBack) { Text("Volver al inicio de sesión") }
    }
}

@Composable
fun VerificationPanel(
    viewModel: LoginViewModel,
    token: String? = null,
) {
    val context = LocalContext.current
    var code by remember { mutableStateOf("") }

    LaunchedEffect(token, viewModel.devLink) {
        when {
            !token.isNullOrBlank() -> {
                code = token
                viewModel.consumeDeepLinkToken(token)
            }
            !viewModel.devLink.isNullOrBlank() -> code = viewModel.devLink.orEmpty()
        }
    }

    Spacer(Modifier.height(20.dp))
    StatusText(
        text = viewModel.verificationMessage?.takeIf { !viewModel.verificationDone }
            ?: "Tu correo no está verificado. Confirma el enlace para poder entrar.",
        success = false,
    )

    OutlinedTextField(
        value = code,
        onValueChange = { code = it },
        label = { Text("Pega aquí el enlace o código") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
    Spacer(Modifier.height(12.dp))
    Button(
        onClick = { viewModel.submitVerificationCode(code) },
        enabled = !viewModel.verificationBusy && code.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(if (viewModel.verificationBusy) "Validando…" else "Verificar correo")
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
            onClick = viewModel::resend,
            enabled = !viewModel.verificationBusy,
            modifier = Modifier.weight(1f),
        ) {
            Text("Reenviar")
        }
        OutlinedButton(
            onClick = {
                val url = "${AppContainer.WEB_APP_URL}/verify-email?email=${Uri.encode(viewModel.email)}"
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            },
            modifier = Modifier.weight(1f),
        ) {
            Text("Abrir web")
        }
    }

    viewModel.verificationMessage?.let { StatusText(it, success = viewModel.verificationDone) }
}

@Composable
private fun StatusText(
    text: String,
    success: Boolean = false,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = if (success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
        modifier = Modifier.padding(top = 12.dp),
    )
}
