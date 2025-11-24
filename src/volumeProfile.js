export function computeVolumeProfile (trades, priceBins = 40) {
    if (!trades || trades.length === 0) return {
        bins: [], poc: null, fva: { low: null, high: null }, stdDev: 0, totalVolume: 0
    }

    const parsed = trades.map(t => ({ p: parseFloat(t.p), q: parseFloat(t.q) }))
    const prices = parsed.map(t => t.p)
    const vols = parsed.map(t => t.q)

    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const step = (max - min) / priceBins || 1

    const bins = Array.from({ length: priceBins }, (_, i) => ({
        min: min + i * step,
        max: min + (i + 1) * step,
        price: min + (i + 0.5) * step,
        volume: 0
    }))

    parsed.forEach(t => {
        const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((t.p - min) / step)))
        bins[idx].volume += t.q
    })

    const volumesList = bins.map(b => b.volume)
    const totalVolume = volumesList.reduce((a, b) => a + b, 0)
    const mean = totalVolume / volumesList.length
    const variance = volumesList.reduce((a, b) => a + (b - mean) ** 2, 0) / volumesList.length
    const stdDev = Math.sqrt(variance)


    // Point of Control (POC) = price of bin with max volume
    const maxBin = bins.reduce((acc, b) => (b.volume > (acc.volume || 0) ? b : acc), {})
    const poc = maxBin.price || null

    // Fair Value Area: smallest range around POC that contains FVA_PCT of total volume
    function computeFVA (bins, pocIndex, targetPct) {
        let low = pocIndex
        let high = pocIndex
        let cumVol = bins[pocIndex].volume
        const target = totalVolume * targetPct
        while (cumVol < target) {
            const expandLow = (low > 0) ? bins[low - 1].volume : -1
            const expandHigh = (high < bins.length - 1) ? bins[high + 1].volume : -1
            if (expandLow === -1 && expandHigh === -1) break
            if (expandLow >= expandHigh) { low -= 1; cumVol += expandLow } else { high += 1; cumVol += expandHigh }
            if (low < 0) low = 0
            if (high > bins.length - 1) high = bins.length - 1
        }
        return { low: bins[low].min, high: bins[high].max }
    }

    const pocIndex = bins.findIndex(b => b.price === poc)
    const fva = (pocIndex >= 0) ? computeFVA(bins, pocIndex, parseFloat(process.env.FVA_PCT || '0.7')) : { low: null, high: null }

    return { bins, poc, fva, stdDev, totalVolume }
}