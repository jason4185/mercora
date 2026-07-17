# Settlement policy

Settlement has one public input: `settle_market(market_id)`. Only the contract owner or configured market operator may call it; regular users are rejected. The caller never supplies evidence or an outcome.

The contract constructs provider-specific URLs for Binance, Bybit, Gate.io, MEXC, and Bitget. It attempts all five sources and accepts a candle only when the response is successful, the exact opening timestamp is present, and open/close are positive canonical decimal values. Close greater than open votes `UP`; equality or a lower close votes `DOWN`.

An individual request, HTTP, empty, malformed, timestamp, or decimal failure becomes `UNAVAILABLE`. Three UP votes settle UP; three DOWN votes settle DOWN; otherwise settlement is `INCONCLUSIVE`.

`run_nondet_unsafe` provides the GenLayer leader/validator boundary. The leader proposes compact canonical evidence. Validators independently run the same five adapters, validate source symbols, intervals, candle timestamps, open/close values, directions, vote counts, and the final outcome. When leader and validator both report a provider as `VALID`, their normalized records must match exactly. Temporary `VALID`/`UNAVAILABLE` differences are tolerated, but a validator never approves `UP` or `DOWN` unless its own five-source calculation reaches that same three-vote result. Raw responses are discarded; deterministic code stores compact normalized evidence only after consensus returns.
