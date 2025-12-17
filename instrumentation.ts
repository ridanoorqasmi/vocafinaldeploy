export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize database sync scheduler on server startup
    try {
      const { initializeDatabaseSyncScheduler } = await import('./lib/database-sync-scheduler')
      initializeDatabaseSyncScheduler()
      console.log('✅ Database sync scheduler initialized via instrumentation')
    } catch (error) {
      console.error('⚠️  Failed to initialize database sync scheduler:', error)
    }
  }
}


