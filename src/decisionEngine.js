export function decide ({ poc, fva, stdDev, totalVolume, currentPrice }) {
    if (!poc || !fva || !currentPrice) return { action: 'NONE', reason: 'insufficient data' }

    // thresholds
    const flatThreshold = 1e-8 // if stdDev is almost zero relative to price
    if (stdDev <= flatThreshold) return { action: 'NONE', reason: 'flat volume distribution' }

    const bufferPct = 0.0025 // 0.25% buffer outside FVA to avoid noise
    const upperBuffer = fva.high * (1 + bufferPct)
    const lowerBuffer = fva.low * (1 - bufferPct)

    // Outside FVA: mean-reversion to POC
    if (currentPrice > upperBuffer) return { action: 'SHORT', reason: `price above FVA.high (>${(bufferPct*100).toFixed(2)}%) -> mean revert to POC` }
    if (currentPrice < lowerBuffer) return { action: 'LONG', reason: `price below FVA.low (<-${(bufferPct*100).toFixed(2)}%) -> mean revert to POC` }

    // Inside FVA: follow direction relative to POC
    if (currentPrice > poc) return { action: 'LONG', reason: 'inside FVA and price above POC -> momentum long' }
    if (currentPrice < poc) return { action: 'SHORT', reason: 'inside FVA and price below POC -> momentum short' }

    return { action: 'NONE', reason: 'no clear rule matched' }
}