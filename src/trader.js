import BinanceClient from './binanceClient.js'

export default class Trader {
    constructor ({ logger }) {
        this.logger = logger
        this.client = new BinanceClient({ logger })
    }

    // place a market order on testnet
    async executeDecision ({ symbol, decision, currentPrice }) {
    if (!decision || decision.action === 'NONE') return { ok: false, reason: 'no action' }

    // We'll use a simple sizing model for demo: fixed qty per symbol. In production, replace with risk sizing.
    const qtyMap = { BTCUSDT: 0.001, ETHUSDT: 0.01, XRPUSDT: 50, SOLUSDT: 0.5 }
    const quantity = qtyMap[symbol] || 0.01
    
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