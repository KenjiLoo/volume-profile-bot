import start from './src/app.js'
import dotenv from 'dotenv'

dotenv.config()

start().catch(err => {
    console.error('Fatal error starting app:', err)
    process.exit(1)
})