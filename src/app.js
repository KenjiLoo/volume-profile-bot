import dotenv from 'dotenv'
dotenv.config()


import express from 'express'
import Scheduler from './scheduler.js'
import Logger from './logger.js'


const logger = new Logger(process.env.LOG_LEVEL || 'info')


export default async function start () {
const app = express()
app.use(express.json())


// Simple health endpoint
app.get('/health', (req, res) => res.json({ ok: true }))


const port = process.env.PORT || 3000
app.listen(port, () => logger.info(`HTTP server listening on ${port}`))


// Start scheduler that drives the polling & decision loop
const scheduler = new Scheduler({ logger })
scheduler.start()
}