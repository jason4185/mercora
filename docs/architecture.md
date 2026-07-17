# Mercora v2 architecture

Mercora is a curated GenLayer crypto prediction market. It has no hosted registry: the deployed Intelligent Contract is the authoritative operational and settlement configuration.

## Responsibility boundary

- Frontend: wallet connection, paginated discovery, contract-backed wallet status and notifications, non-authoritative display, and admin submission of `create_market(asset, candle_start)` after a read-only contract preview.
- Worker: cursor-based due-market discovery and `settle_market(market_id)` submission from the configured market-operator wallet only. It never provides evidence or an outcome.
- Intelligent Contract: owner/operator access control, dynamic market derivation, fixed timing and economics, five approved exchange adapters, escrow, exact candle validation, three-of-five voting, evidence storage, payouts, and refunds.
- Exchanges: raw historical spot-candle evidence from Binance, Bybit, Gate.io, MEXC, and Bitget.
- GenLayer validators: independent retrieval and verification of evidence and the proposed settlement state transition.

Fixed protocol rules are not hardcoded individual markets. The owner or configured operator creates each BTC, ETH, BNB, or SOL market dynamically by supplying only an asset and future UTC-hour candle start. The contract derives every other immutable term.

## Consensus boundary

Settlement uses the contract's custom `run_nondet_unsafe` leader/validator pair. The leader requests the exact completed one-hour candle from all five exchanges, normalizes positive open and close prices, derives `UP` for close greater than open and `DOWN` otherwise, and proposes compact evidence. Each validator independently repeats those requests and calculations. A validator never approves `UP` or `DOWN` unless its own evidence reaches the same three-of-five result; when both executions have valid evidence for a provider, their normalized records must match exactly. Temporary valid/unavailable differences are tolerated only when the validator independently derives the same final result.

Only the consensus-approved return value crosses back into deterministic execution. The contract stores evidence and outcome afterward, then enables claims or refunds. Complex state is deterministic JSON in `TreeMap[str, str]`; separate flat maps preserve wallet positions, claims, duplicate-market checks, and bounded indexes.
