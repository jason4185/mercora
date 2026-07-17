# Mercora v2

Mercora is a curated GenLayer prediction market for the direction of completed one-hour cryptocurrency spot candles. The owner or configured market operator schedules markets for BTC, ETH, BNB, or SOL against USDT. Bettors choose `UP` or `DOWN`; they cannot create markets or supply questions, rules, categories, specifications, evidence URLs, prices, votes, or outcomes.

`UP` means the completed one-hour candle closed strictly higher than it opened. `DOWN` means it closed equal to or lower than it opened. All candles use the canonical `1H` interval and UTC boundaries.

## Why GenLayer consensus is necessary

Mercora resolves each one-hour crypto market through two verification layers. The Intelligent Contract retrieves completed historical spot candles from five independent exchanges and deterministically derives a directional vote from each valid source. At least three exchanges must agree on the direction. GenLayer validators independently fetch and verify the same evidence, each source direction, the vote totals, and the proposed settlement result before the outcome is finalized on-chain.

The exchanges are evidence providers, not GenLayer validators. Source-level consensus answers whether at least three of Binance, Bybit, Gate.io, MEXC, and Bitget report the same direction. GenLayer validator consensus independently verifies that the contract fetched the correct candle from each source, normalized it correctly, counted the votes correctly, and proposed the corresponding state transition.

## Market lifecycle

For a candle from 18:00 to 19:00 UTC:

1. The owner or operator calls `create_market("BTC", candle_start)` at least 30 minutes before 18:00.
2. The contract derives `BTCUSDT`, the display question, rules, duplicate key, 18:00 betting close, 19:00 candle end, and 19:02 settlement time from its own constants.
3. Users stake 1–10 GEN cumulatively per wallet on `UP` or `DOWN`. Betting stops exactly at 18:00.
4. After 19:02, the owner or configured market operator calls `settle_market(market_id)` with no outcome arguments. In production, the market operator is the cron wallet.
5. The leader fetches all five exact historical candles and proposes canonical evidence. Validators independently refetch and verify the market context, source values, directions, vote counts, and final result. A transient validator-side outage is tolerated only if the remaining evidence still independently proves that result.
6. Three matching direction votes settle `UP` or `DOWN`. Otherwise the market is `INCONCLUSIVE`.
7. Winners claim their proportional share of the full pari-mutuel pool. `INCONCLUSIVE` and `CANCELLED` markets refund original stakes.

One-sided or empty markets are `CANCELLED`. A failed individual exchange is `UNAVAILABLE` and does not fail the settlement transaction by itself.

## Trust boundary

- `contract/MercoraMarket.py` owns access control, market derivation, escrow, source requests, candle validation, direction/vote calculation, evidence storage, settlement, claims, and refunds.
- `cron/` only paginates due markets and calls `settle_market(market_id)` from the configured market-operator wallet. It does not hold balances or authoritative evidence.
- `frontend/` is a non-authoritative repository harness. It displays markets and submits user/operator calls but cannot determine settlement.

Mercora does not use a hosted registry or configuration website. The deployed Intelligent Contract source is authoritative for the fixed protocol rules: supported assets, one-hour timing, stake limits, the five approved exchange adapters, and the three-of-five settlement threshold. Fixed protocol rules do not hardcode individual markets; the owner or market operator dynamically creates each market with `create_market(asset, candle_start)`.

The frontend exposes `/admin/markets` for authorized creation. It reads `owner` and `market_operator` from `get_protocol_stats()`, uses case-insensitive wallet comparison for UI gating, and converts separate date/hour selections with `Date.UTC` so browser-local time cannot alter the submitted candle boundary. Direct navigation remains available to unauthorized wallets, but the form stays disabled and the contract performs the final authorization check.

Read-only discovery is cursor-based: `get_market_ids` returns newest-first global history, `get_completed_market_ids` returns terminal results, and `get_active_market_ids`/`get_due_market_ids` cover open and settlement-ready markets. `/dashboard` uses `get_user_market_ids_page` and `get_user_market_status` for authoritative wallet history, claim/refund actions, and notifications. The admin preview uses `validate_market_creation`, `get_market_id_by_key`, and `get_market_configuration`; the write method still repeats every validation and authorization check.

## Source adapters

| Provider | Spot endpoint | Interval | Timestamp | Symbol form |
|---|---|---|---|---|
| Binance | `/api/v3/klines` | `1h` | milliseconds | `BTCUSDT` |
| Bybit | `/v5/market/kline` | `60` | milliseconds | `BTCUSDT` |
| Gate.io | `/api/v4/spot/candlesticks` | `1h` | seconds | `BTC_USDT` |
| MEXC | `/api/v3/klines` | `60m` | milliseconds | `BTCUSDT` |
| Bitget | `/api/v3/market/candles` | `1H` | milliseconds | `BTCUSDT` |

Every adapter requires the exact candle-opening timestamp and positive decimal open/close values. Prices are stored as compact normalized strings. Exchanges need to agree only on direction, not on identical prices.

The contract implements a dedicated Binance, Bybit, Gate.io, MEXC, and Bitget response adapter; only HTTP/JSON retrieval and normalized row validation are shared. The pair, interval, time units, URL parameters, response container, success code, and field indexes remain provider-specific.

## Storage

Complex records use deterministic, sorted, compact JSON stored in `TreeMap[str, str]`. `u256` values inside JSON are decimal strings. Separate string maps hold UP stakes, DOWN stakes, wallet totals, claims, claimed amounts, duplicate keys, and wallet participation indexes. Global, completed, due, active, and wallet histories use bounded cursor pagination. No nested `TreeMap` values are used.

Settlement leader and validator functions operate only on copied scalar market context and nondeterministically retrieved evidence. They do not mutate storage or transfer funds. Deterministic code stores the result only after `run_nondet_unsafe` returns the consensus-approved proposal.

## Local checks

```sh
genvm-lint check contract/MercoraMarket.py --json
genvm-lint typecheck contract/MercoraMarket.py --json
genvm-lint schema contract/MercoraMarket.py --json
python3 -m py_compile contract/MercoraMarket.py
python3 -m pytest tests -q

cd frontend && npm ci && npm run typecheck && npm run lint && npm test && npm run build
cd ../cron && npm ci && npm run typecheck && npm test
```

Install Python development dependencies with `python3 -m pip install -r requirements-dev.txt`. `config/mercora.v2.json` intentionally leaves `focused_crypto_v2_current` empty until Studio/testnet validation and deployment are explicitly authorized. Nothing in this repository has been deployed.
