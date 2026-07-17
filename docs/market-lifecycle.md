# Market lifecycle

1. **Creation:** owner or operator selects BTC, ETH, BNB, or SOL and a UTC-hour-aligned candle start at least 30 minutes in the future. The authoritative contract derives all other fields from fixed protocol constants.
2. **OPEN:** users stake 1–10 GEN cumulatively on one position, `UP` or `DOWN`.
3. **CLOSED:** betting stops exactly at candle start while the one-hour candle completes.
4. **READY_FOR_SETTLEMENT:** candle end plus the 120-second safety delay has passed.
5. **SETTLED:** at least three valid exchange sources vote for `UP` or `DOWN`; winners claim pari-mutuel payouts.
6. **INCONCLUSIVE:** neither direction gets three valid votes; bettors claim original-stake refunds.
7. **CANCELLED:** either side has no stake at settlement; bettors claim original-stake refunds.

Stored status remains `OPEN` before settlement, while the display view derives `CLOSED` and `READY_FOR_SETTLEMENT` from `gl.message_raw["datetime"]`.
