# Deployment guide

Mercora v2 deploys as a zero-argument contract. It has no registry publication or configuration-site dependency.

Before any explicitly authorized deployment:

1. Review the pinned GenVM runner and the contract-owned market, timing, economics, provider, parsing, and voting constants.
2. Run contract validation, direct tests, frontend checks, and worker checks when validation is authorized.
3. Verify completed candles for all four assets across Binance, Bybit, Gate.io, MEXC, and Bitget.
4. Run full leader/validator integration settlement in GenLayer Studio, including partial outages and validator disagreement.
5. Estimate deployment gas and compare it with the current block limit.
6. Review the generated ABI, source hash, owner account, and intended operator.

Before enabling the settlement worker, derive its public address from the secret `SIGNER_PRIVATE_KEY` and set that exact address as the contract's `market_operator`. The contract rejects settlement submissions from every other wallet except the owner.

`focused_crypto_v2_current` remains empty in `config/mercora.v2.json` until an explicitly authorized deployment finalizes. The deployment utilities are `tests/deployment-diagnostics/deploy-v2.mjs` and `tests/deployment-diagnostics/create-market-write.mjs`; the latter submits only `create_market(asset, candle_start)` from its reviewed input file.
