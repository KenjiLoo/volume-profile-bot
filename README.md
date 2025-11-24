# Volume Profile Bot (Express + Binance testnet)


This project polls Binance aggTrades and computes a volume profile for the current 1h candle for configured symbols. Right before the candle closes it computes the Point of Control (POC) and Fair Value Area (FVA) and makes a trading decision (LONG/SHORT/NONE). Orders are sent to Binance testnet using your test API keys.


## Structure
- `index.js` - entrypoint (only file you need to run)
- `src/` - modular code following single responsibility & SOLID-friendly structure


## How the decision works (summary)
1. Compute volume bins for the current hourly candle.
2. Identify POC = price bin with highest traded volume.
3. Expand from the POC outwards until cumulative volume reaches the FVA percentage (default 70%) to form FVA.low and FVA.high.
4. If current price is above FVA.high + buffer => SHORT (mean reversion to POC).
If current price is below FVA.low - buffer => LONG (mean reversion to POC).
If price inside FVA => follow momentum relative to POC: price>POC -> LONG, price<POC -> SHORT.
5. StdDev of volumes across bins is computed and used to filter flat/noisy profiles.


## Run
1. Copy `.env.example` to `.env` and fill your testnet keys.
2. `npm install`
3. `npm start`
