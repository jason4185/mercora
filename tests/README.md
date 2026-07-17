# Testing guide

Direct contract tests use the official `gltest` runtime. Install the pinned development dependencies from `requirements-dev.txt`. The test-only `warp` helper synchronizes `gl.message_raw["datetime"]`; production time remains transaction-derived.

Run:

```sh
python3 -m pytest tests -q
```

The suite covers contract-owned configuration, owner/operator creation and lead time, derived timing, betting bounds, participation indexing, every required three-of-five settlement matrix, each dedicated provider adapter, all source failure classes, exact timestamps, decimal normalization, validator re-fetches, tampered leader proposals, validator-side outage tolerance, proportional claims, refunds, cancellation, nondeterministic storage isolation, and bounded pagination. Direct mode exercises both captured leader and validator functions; distributed validator/network behavior still requires Studio or testnet integration validation before deployment.
