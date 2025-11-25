import axios from 'axios'
import crypto from 'crypto'
import { BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_USE_TESTNET } from './config.js'

// Always use Binance USDT-M Futures mainnet or testnet
const baseURL = BINANCE_USE_TESTNET 
    ? 'https://testnet.binancefuture.com'
    : 'https://fapi.binance.me'

export default class BinanceClient {
    constructor({ logger }) {
        this.logger = logger

        this.axios = axios.create({ baseURL })

        console.log("Binance API Key:", BINANCE_API_KEY)

        if (BINANCE_API_KEY) {
            this.axios.defaults.headers['X-MBX-APIKEY'] = BINANCE_API_KEY
        }
    }

    /* -----------------------------------------------------------
        ERROR HANDLING WRAPPER
       ----------------------------------------------------------- */
    async safeRequest(promise, context = "") {
        try {
            return await promise
        } catch (err) {
            // Extract everything useful from axios error
            const status = err.response?.status
            const statusText = err.response?.statusText
            const data = err.response?.data
            const url = err.config?.url
            const method = err.config?.method
            const query = err.config?.params
            const body = err.config?.data

            this.logger.error("📛 BINANCE API ERROR")
            this.logger.error(`Context: ${context}`)
            this.logger.error(`URL: ${method?.toUpperCase()} ${url}`)
            this.logger.error(`Status: ${status} ${statusText}`)
            this.logger.error(`Query Params: ${JSON.stringify(query)}`)
            this.logger.error(`Request Body: ${body}`)
            this.logger.error(`Response: ${JSON.stringify(data)}`)

            throw new Error(
                `Binance API Error (${context}): ${status} ${statusText} - ${JSON.stringify(data)}`
            )
        }
    }

    /* -----------------------------------------------------------
        FUTURES KLINES
       ----------------------------------------------------------- */
    async getKlines(symbol, interval = '1h', limit = 2) {
        const res = await this.safeRequest(
            this.axios.get('/fapi/v1/klines', {
                params: { symbol, interval, limit }
            }),
            `getKlines(${symbol})`
        )
        return res.data
    }

    /* -----------------------------------------------------------
        FUTURES AGG TRADES
       ----------------------------------------------------------- */
    async getAggTradesRange(symbol, startTime, endTime) {
        const trades = []
        let fromId = undefined

        while (true) {
            const params = { symbol, startTime, endTime, limit: 1000 }
            if (fromId) params.fromId = fromId

            const res = await this.safeRequest(
                this.axios.get('/fapi/v1/aggTrades', { params }),
                `getAggTradesRange(${symbol})`
            )

            const batch = res.data
            if (!batch || batch.length === 0) break

            trades.push(...batch)
            if (batch.length < 1000) break

            fromId = batch[batch.length - 1].a + 1
        }

        this.logger.debug(`Fetched ${trades.length} futures aggTrades for ${symbol}`)
        return trades
    }

    /* -----------------------------------------------------------
        FUTURES RECENT TRADES
       ----------------------------------------------------------- */
    async getRecentTrades(symbol, limit = 1) {
        const res = await this.safeRequest(
            this.axios.get('/fapi/v1/trades', {
                params: { symbol, limit }
            }),
            `getRecentTrades(${symbol})`
        )
        return res.data
    }

    /* -----------------------------------------------------------
        SIGNATURE
       ----------------------------------------------------------- */
    sign(queryString) {
        return crypto
            .createHmac('sha256', BINANCE_API_SECRET)
            .update(queryString)
            .digest('hex')
    }

    /* -----------------------------------------------------------
        PLACE FUTURES ORDER
       ----------------------------------------------------------- */
    async placeOrder(symbol, side, type, quantity, price = undefined) {
        const timestamp = Date.now()

        const params = new URLSearchParams({
            symbol,
            side,
            type,
            quantity: String(quantity),
            timestamp: String(timestamp)
        })

        if (price) params.append('price', String(price))

        const signature = this.sign(params.toString())
        params.append('signature', signature)

        const res = await this.safeRequest(
            this.axios.post(
                '/fapi/v1/order',
                params.toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ),
            `placeOrder(${symbol}, ${side})`
        )

        return res.data
    }
}
