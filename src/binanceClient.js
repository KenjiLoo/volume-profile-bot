import axios from 'axios'
import crypto from 'crypto'
import { BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_USE_TESTNET, DEFAULT_LEVERAGE} from './config.js'

// Always use Binance USDT-M Futures mainnet or testnet
const baseURL = BINANCE_USE_TESTNET 
    ? 'https://testnet.binancefuture.com'
    : 'https://fapi.binance.me'

const priceMap = new Map();

export default class BinanceClient {
    constructor({ logger }) {
        this.logger = logger

        this.axios = axios.create({ baseURL })

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

        let price = res.data[0][4]
        priceMap.set(symbol, price)

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
        SET FUTURES LEVERAGE
        ----------------------------------------------------------- */
    async setLeverage(symbol) {
        const timestamp = Date.now()

        const params = new URLSearchParams({
            symbol,
            leverage: String(DEFAULT_LEVERAGE),
            timestamp: String(timestamp)
        })

        const signature = this.sign(params.toString())
        params.append('signature', signature)

        return await this.safeRequest(
            this.axios.post('/fapi/v1/leverage', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }),
            `setLeverage(${symbol}, ${DEFAULT_LEVERAGE})`
        )
    }

    /* -----------------------------------------------------------
        SET MARGIN MODE = ISOLATED
        ----------------------------------------------------------- */
    async setMarginType(symbol) {
        const timestamp = Date.now()

        const params = new URLSearchParams({
            symbol,
            marginType: 'ISOLATED',
            timestamp: String(timestamp)
        })

        const signature = this.sign(params.toString())
        params.append('signature', signature)

        try {
            return await this.safeRequest(
                this.axios.post('/fapi/v1/marginType', params.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }),
                `setMarginType(${symbol}, ISOLATED)`
            )
        } catch (err) {
            if (err.message.includes('No need to change margin type')) {
                return
            }
            throw err
        }
    }

    /* -----------------------------------------------------------
        PLACE FUTURES ORDER
       ----------------------------------------------------------- */
    async placeOrder(symbol, side, type, usdtAmount, entryPrice = undefined) {
        const timestamp = Date.now()

        // 1️⃣ Always force leverage + ISOLATED
        await this.setMarginType(symbol)
        await this.setLeverage(symbol)

        // 2️⃣ Convert USDT → quantity using leverage
        const leveragedNotional = usdtAmount * DEFAULT_LEVERAGE
        const qty = leveragedNotional / priceMap.get(symbol)

        const params = new URLSearchParams({
            symbol,
            side,
            type,
            quantity: String(qty),
            timestamp: String(timestamp)
        })

        if (entryPrice) params.append('price', String(entryPrice))

        const signature = this.sign(params.toString())
        params.append('signature', signature)

        // 3️⃣ PLACE ENTRY ORDER
        const entry = await this.safeRequest(
            this.axios.post('/fapi/v1/order', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }),
            `placeOrder(${symbol}, ${side})`
        )

        const executedPrice = entryPrice || priceMap.get(symbol)

        // 4️⃣ RISK:REWARD = 3:2
        const riskPct = 0.01
        const rewardMultiplier = 1.5

        const riskAmount = executedPrice * riskPct
        const rewardAmount = riskAmount * rewardMultiplier

        let stopLoss, takeProfit

        if (side === "BUY") {
            stopLoss = executedPrice - riskAmount
            takeProfit = executedPrice + rewardAmount
        } else {
            stopLoss = executedPrice + riskAmount
            takeProfit = executedPrice - rewardAmount
        }

        // 5️⃣ STOP LOSS
        await this.safeRequest(
            this.axios.post('/fapi/v1/order',
                new URLSearchParams({
                    symbol,
                    side: side === "BUY" ? "SELL" : "BUY",
                    type: "STOP_MARKET",
                    stopPrice: stopLoss,
                    closePosition: "true",
                    timestamp: Date.now()
                }).toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ),
            `SL(${symbol})`
        )

        // 6️⃣ TAKE PROFIT
        await this.safeRequest(
            this.axios.post('/fapi/v1/order',
                new URLSearchParams({
                    symbol,
                    side: side === "BUY" ? "SELL" : "BUY",
                    type: "TAKE_PROFIT_MARKET",
                    stopPrice: takeProfit,
                    closePosition: "true",
                    timestamp: Date.now()
                }).toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ),
            `TP(${symbol})`
        )

        return {
            entry: entry.data,
            stopLoss,
            takeProfit
        }
    }
}
