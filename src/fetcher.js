// Fetcher responsibility: for a symbol & timeframe (1h), fetch current candle info and aggTrades in the current open candle window
import BinanceClient from './binanceClient.js'
import { DECISION_GRACE_SEC } from './config.js'

export default class Fetcher {
    constructor ({ logger }) {
        this.client = new BinanceClient({ logger })
        this.logger = logger
    }

    // Returns { openTime, closeTime, trades }
    async fetchCurrentCandleTrades (symbol, interval = '1h') {
        // get last 2 klines and take the last one as CURRENT candle
        const klines = await this.client.getKlines(symbol, interval, 2)
        const current = klines[klines.length - 1]
        const openTime = current[0]
        const closeTime = current[6]

        // For current candle we fetch aggTrades from openTime to now (or to closeTime if in the past)
        const now = Date.now()
        const endTime = Math.min(now, closeTime - (DECISION_GRACE_SEC * 1000))
        // If endTime <= openTime, there are no trades
        let trades = []
        if (endTime > openTime) trades = await this.client.getAggTradesRange(symbol, openTime, endTime)

        return { openTime, closeTime, trades }
    }
}