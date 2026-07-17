# Frontend integration

The production UI must reflect the focused contract interface.

## Market creation

Use `/admin/markets` for creation. Read `get_protocol_stats()` and compare the connected address case-insensitively with `owner` and `market_operator`; hiding or disabling controls is only a usability check because the contract remains authoritative. Inputs are limited to asset (`BTC`, `ETH`, `BNB`, `SOL`), a UTC date, and an exact UTC hour at least 30 minutes in the future. Construct seconds with `Date.UTC(year, monthIndex, day, hour, 0, 0) / 1000`, then call `create_market(asset, candle_start)`. Never collect or submit a question, direction rules, category, type, specification, source URL, price, vote, or outcome.

Read `get_market_configuration()` for supported assets and display rules. Call `validate_market_creation(asset, candle_start)` before requesting a wallet signature and show its structured reason. After confirmation, use `get_market_id_by_key(asset, candle_start)` to identify the created market.

## Betting

Display `UP` and `DOWN`, enforce a 1 GEN frontend minimum and show the 10 GEN cumulative wallet cap, while treating the contract as authoritative. Call `place_bet(market_id, position)` with attached GEN value.

## Reads and settlement display

Use `get_market_ids` for newest-first discovery, `get_completed_market_ids` for results, `get_active_market_ids` for open markets, and `get_due_market_ids` for settlement readiness. Keep page sizes bounded and advance the returned cursor. Display the five compact source records, vote counts, and final outcome without describing exchanges as validators. Only the owner or configured market operator may call `settle_market(market_id)` after readiness; the normal user interface must not offer settlement actions.

## Wallet dashboard

Page wallet history with `get_user_market_ids_page`, then read `get_user_market_status` for each returned ID. Treat its `user_result`, claimable/refundable amount, and claimed fields as authoritative for dashboard labels, claim buttons, and in-app notifications. Show claim actions only for `WON` and `REFUND_AVAILABLE`.

## Claims

Call `claim_winnings` only for settled UP/DOWN winners. Call `claim_refund` for `INCONCLUSIVE` or `CANCELLED` participants. Never calculate an authoritative payout or balance in the frontend.
