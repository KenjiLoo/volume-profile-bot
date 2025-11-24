import start from './src/app.js'

start().catch(err => {
    console.error('Fatal error starting app:', err)
    process.exit(1)
})