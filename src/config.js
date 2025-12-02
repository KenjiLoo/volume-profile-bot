import dotenv from 'dotenv'
dotenv.config()

export const SYMBOLS = (process.env.SYMBOLS || 'BTCUSDT,ETHUSDT,XRPUSDT,SOLUSDT').split(',').map(s => s.trim())
export const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10)
export const PRICE_BINS = parseInt(process.env.PRICE_BINS || '40', 10)
export const FVA_PCT = parseFloat(process.env.FVA_PCT || '0.7')
export const DECISION_GRACE_SEC = parseInt(process.env.DECISION_GRACE_SEC || '5', 10)
export const BINANCE_API_KEY = process.env.BINANCE_API_KEY || ''
export const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || ''
export const BINANCE_USE_TESTNET = (process.env.BINANCE_USE_TESTNET || 'true') === 'true'
export const USDT_QTY = process.env.USDT_QTY || 100