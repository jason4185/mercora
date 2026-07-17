# Security policy

Do not commit wallet private keys, keychain exports, passwords, RPC credentials, or Cloudflare secrets. The worker key is configured only as `SIGNER_PRIVATE_KEY` and may call only public contract methods; it has no authority to submit prices, votes, evidence, balances, or outcomes.

The contract constructs all five evidence URLs internally and treats responses as untrusted. Settlement requires exact historical candle timestamps, positive canonical decimal values, deterministic direction derivation, three matching source votes, and independent leader/validator re-fetching. Raw API payloads are not persisted.

Report suspected vulnerabilities privately to the repository owner with the affected version and reproducible steps. Never include private keys.
