# Settlement worker

The scheduled Cloudflare Worker paginates `get_due_market_ids`, re-reads each focused one-hour crypto market, skips anything no longer `OPEN`, acquires an atomic Durable Object lock, and submits only `settle_market(market_id)`. Its signer address must be configured on the contract as `market_operator`; the owner is the only other permitted settlement caller. The worker never sends prices, evidence, source availability, votes, directions, or an outcome.

Writes encode the official GenLayer consensus call, request `eth_estimateGas`, add the configured 30% margin, verify the padded amount is below the latest block gas limit, submit the underlying EVM transaction, extract the GenLayer transaction ID, and wait for finality. A reverted EVM call is not blindly resubmitted. Only transient discovery/submission errors receive bounded retries.

Configure `MERCORA_CONTRACT_ADDRESS` as a normal variable and `SIGNER_PRIVATE_KEY` with `wrangler secret put SIGNER_PRIVATE_KEY`; never store it in `.dev.vars` or source control. Configure the signer's public address through `set_market_operator` before scheduling the worker. Use `.dev.vars.example` only as a name reference.

Run `npm ci` to install the locked dependencies, then `npm run typecheck && npm test` before deployment. The five tests cover pagination, filtering, transient retry, duplicate suppression, and the invariant that no outcome is sent.
