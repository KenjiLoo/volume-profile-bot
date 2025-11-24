import { POLL_INTERVAL_MS, SYMBOLS, PRICE_BINS, DECISION_GRACE_SEC } from './config.js'
import Fetcher from './fetcher.js'
import { computeVolumeProfile } from './volumeProfile.js'
import { decide } from './decisionEngine.js'
import Trader from './trader.js'

export default class Scheduler {
    constructor ({ logger }) {
        this.logger = logger
        this.fetcher = new Fetcher({ logger })
        this.trader = new Trader({ logger })
        this.running = false
    }

    start () {
        if (this.running) return
        this.running = true
        this.logger.info('Scheduler started')
        // Poll every POLL_INTERVAL_MS and for each symbol run the analysis
        setInterval(() => this.tick().catch(err => this.logger.error(err)), POLL_INTERVAL_MS)
    }

    async tick () {
        const promises = SYMBOLS.map(symbol => this.processSymbol(symbol))
        await Promise.all(promises)
    }

    async processSymbol (symbol) {
        try {
            const { openTime, closeTime, trades } = await this.fetcher.fetchCurrentCandleTrades(symbol, '1h')
            const now = Date.now()
            const timeLeftSec = Math.max(0, Math.floor((closeTime - now) / 1000))
            this.logger.debug(`${symbol} time left in candle: ${timeLeftSec}s, trades: ${trades.length}`)

            // Compute profile on the trades we have so far
            const profile = computeVolumeProfile(trades, PRICE_BINS)

            // Only attempt decision in the decision window (right before close)
            if (timeLeftSec <= DECISION_GRACE_SEC) {
                // get current price
                const recent = await this.fetcher.client.getRecentTrades(symbol, 1)
                const currentPrice = parseFloat(recent[0].price || recent[0].p || recent[0].price)

                const decision = decide({ poc: profile.poc, fva: profile.fva, stdDev: profile.stdDev, totalVolume: profile.totalVolume, currentPrice })
                this.logger.info(`${symbol} decision`, decision.action, decision.reason)

                if (decision.action !== 'NONE') {
                    await this.trader.executeDecision({ symbol, decision, currentPrice })
                }
            }
        } catch (err) {
            this.logger.error(`Processing ${symbol} failed:`, err.message || err)
        }
    }
}