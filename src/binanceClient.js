import axios from 'axios'
import crypto from 'crypto'
import { BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_USE_TESTNET } from './config.js'


const baseURL = BINANCE_USE_TESTNET
    ? 'https://testnet.binance.vision/api'
    : 'https://api.binance.com/api'


// Note: we only implement the minimal methods needed: klines, aggTrades, recentTrades, and signed order
export default class BinanceClient {
    constructor ({ logger }) {
        this.logger = logger
        this.axios = axios.create({ baseURL })
        if (BINANCE_API_KEY) this.axios.defaults.headers['X-MBX-APIKEY'] = BINANCE_API_KEY
    }


    async getKlines (symbol, interval = '1h', limit = 2) {
        const res = await this.axios.get('/v3/klines', { params: { symbol, interval, limit } })
        return res.data
    }


    // Fetch aggTrades for a time window with pagination
    async getAggTradesRange (symbol, startTime, endTime) {
        const trades = []
        let fromId = undefined

        while (true) {
            const params = { symbol, startTime, endTime, limit: 1000 }

            if (fromId) params.fromId = fromId

            const res = await this.axios.get('/v3/aggTrades', { params })

            if (!res.data || res.data.length === 0) break

            trades.push(...res.data)

            if (res.data.length < 1000) break
            
            // next fromId is last agg trade's a + 1
            fromId = (res.data[res.data.length - 1].a || res.data[res.data.length - 1].aggId) + 1
        }

        this.logger.debug(`Fetched ${trades.length} aggTrades for ${symbol}`)
        return trades
    }


    async getRecentTrades (symbol, limit = 1) {
        const res = await this.axios.get('/v3/trades', { params: { symbol, limit } })
        return res.data
    }


    // Signed order (testnet will accept if credentials are testnet keys)
    sign (queryString) {
        return crypto.createHmac('sha256', BINANCE_API_SECRET).update(queryString).digest('hex')
    }


    async placeOrder (symbol, side, type, quantity, price = undefined) {
        const timestamp = Date.now()
        const params = new URLSearchParams({ symbol, side, type, quantity: String(quantity), timestamp: String(timestamp) })
        if (price) params.append('price', String(price))
        const signature = this.sign(params.toString())
        params.append('signature', signature)
        const res = await this.axios.post('/v3/order', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        return res.data
    }
}