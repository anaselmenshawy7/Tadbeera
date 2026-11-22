package com.tedbeera.egypt

import android.app.Application
import com.tedbeera.egypt.data.local.AppDatabase
import com.tedbeera.egypt.data.repository.TedbeeraRepository

class TedbeeraApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var repository: TedbeeraRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getDatabase(this)
        repository = TedbeeraRepository(database)

    }
}
