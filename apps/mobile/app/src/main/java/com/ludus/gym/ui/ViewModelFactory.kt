package com.ludus.gym.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

/** Fábrica pequeña para crear ViewModels con el contenedor manual de dependencias. */
fun <T : ViewModel> viewModelFactory(create: () -> T): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = create() as VM
    }
