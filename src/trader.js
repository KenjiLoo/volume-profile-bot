import BinanceClient from './binanceClient.js'
import { USDT_QTY } from './config.js'

export default class Trader {
    constructor ({ logger }) {
        this.logger = logger
        this.client = new BinanceClient({ logger })
    }

    // place a market order on testnet
    async executeDecision ({ symbol, decision, currentPrice }) {
    if (!decision || decision.action === 'NONE') return { ok: false, reason: 'no action' }

    const quantity = USDT_QTY
    
    const side = decision.action === 'LONG' ? 'BUY' : 'SELL'

    // type=MARKET for immediate execution
    try {
        const resp = await this.client.placeOrder(symbol, side, 'MARKET', quantity)
        this.logger.info(`Executed ${side} ${quantity} ${symbol} at market`, resp && resp.orderId)
        return { ok: true, resp }
    } catch (err) {
        this.logger.error('Order failed', err.response ? err.response.data : err.message)
        return { ok: false, reason: err.message }
        }
    }
}
