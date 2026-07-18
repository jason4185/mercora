import { MERCORA_CONTRACT_ADDRESS, MERCORA_NETWORK } from "@/config/mercora";

export const PRODUCTION_LINKS = {
  liveApp: "https://mercora-omega.vercel.app/",
  contractAddress: MERCORA_CONTRACT_ADDRESS,
  explorerBaseUrl: MERCORA_NETWORK.blockExplorers?.default.url ?? null,
  explorerName: MERCORA_NETWORK.blockExplorers?.default.name ?? "Bradbury Explorer",
  contractExplorerUrl: null,
  contractSource: "https://github.com/jason4185/mercora/blob/main/contract/MercoraMarket.py",
  githubRepository: "https://github.com/jason4185/mercora",
  settlementWorker: "https://mercora-settlement-worker.jxson-parametrix.workers.dev/health",
  technicalDocs: "https://github.com/jason4185/mercora#readme",
} as const;

export const MARKET_DOCS = {
  supportedAssets: ["BTC", "ETH", "BNB", "SOL"],
  quoteAsset: "USDT",
  marketPeriod: "One exact UTC hour",
  intervalSeconds: 3_600,
  minimumCreationLeadSeconds: 1_800,
  minimumStakeGen: "1",
  maximumStakeGen: "10",
  settlementSafetyDelaySeconds: 120,
  workerGraceSeconds: 180,
  requiredVotes: 3,
  sourceCount: 5,
  outcomes: ["UP", "DOWN", "INCONCLUSIVE", "CANCELLED"],
} as const;

export const SETTLEMENT_PROVIDERS = ["Binance", "Bybit", "Gate.io", "MEXC", "Bitget"] as const;

export const DOC_SECTIONS = [
  { id: "how-mercora-works", label: "How Mercora Works" },
  { id: "supported-markets", label: "Supported Markets" },
  { id: "market-timeline", label: "Market Timeline" },
  { id: "prediction-limits", label: "Prediction Limits" },
  { id: "pool-payouts", label: "Pool Probabilities and Payouts" },
  { id: "price-checks", label: "How Prices Are Checked" },
  { id: "genlayer-results", label: "How GenLayer Confirms Results" },
  { id: "cancelled-inconclusive", label: "Cancelled and Inconclusive Markets" },
  { id: "winnings-refunds", label: "Winnings and Refunds" },
  { id: "market-permissions", label: "Market Permissions" },
  { id: "trust-safety", label: "Trust and Safety" },
  { id: "production-links", label: "Production Links" },
  { id: "developer-reference", label: "Developer Reference" },
] as const;

export const HOW_IT_WORKS_STEPS = [
  "An authorized creator opens a BTC, ETH, BNB, or SOL market for a future UTC hour.",
  "Users choose UP or DOWN and stake GEN before that hour starts.",
  "Betting closes when the one-hour candle begins.",
  "The candle completes.",
  "The automated Worker calls settlement after the required delays.",
  "GenLayer checks five exchange candles and requires three matching directions.",
  "Winners can claim; cancelled or inconclusive participants can refund.",
] as const;

export const MARKET_TIMELINE = [
  "Market created",
  "Betting open",
  "Candle starts and betting closes",
  "One-hour candle ends",
  "Contract delay",
  "Worker grace",
  "Settlement check",
  "Result or refund state",
] as const;

export const TRUST_SAFETY_ROWS = [
  {
    component: "Frontend",
    role: "Displays data and submits user requests",
    cannotDo: "Cannot choose results or invent balances",
  },
  {
    component: "Worker",
    role: "Finds due markets and calls settlement",
    cannotDo: "Cannot submit prices or choose UP/DOWN",
  },
  {
    component: "Owner/operator",
    role: "Creates markets and triggers settlement",
    cannotDo: "Cannot override the source-vote outcome",
  },
  {
    component: "Exchanges",
    role: "Supply candle evidence",
    cannotDo: "One exchange alone cannot decide",
  },
  {
    component: "Leader",
    role: "Proposes evidence and result",
    cannotDo: "Cannot finalize without validators",
  },
  {
    component: "Validators",
    role: "Independently verify evidence",
    cannotDo: "Cannot change user stakes",
  },
  {
    component: "Contract",
    role: "Holds state and applies rules",
    cannotDo: "Does not rely on frontend financial guesses",
  },
] as const;

export const READ_METHODS = [
  { name: "get_market", description: "Returns the full market record." },
  { name: "market_exists", description: "Checks whether a market ID exists." },
  { name: "get_market_count", description: "Returns the total number of created markets." },
  { name: "get_market_display_status", description: "Returns the time-aware display status." },
  {
    name: "is_market_ready_for_settlement",
    description: "Checks whether the contract settlement delay has passed.",
  },
  { name: "get_due_market_ids", description: "Lists open markets ready for settlement." },
  { name: "get_active_market_ids", description: "Lists open or in-progress markets." },
  { name: "get_market_ids", description: "Lists market IDs from newest to oldest." },
  {
    name: "get_completed_market_ids",
    description: "Lists settled, cancelled, or inconclusive IDs.",
  },
  {
    name: "get_market_probabilities_bps",
    description: "Returns pool percentages in basis points.",
  },
  { name: "get_user_position", description: "Returns a wallet's stake and chosen side." },
  { name: "get_user_market_ids", description: "Lists markets where a wallet participated." },
  { name: "get_user_market_ids_page", description: "Paginates a wallet's participated markets." },
  {
    name: "get_user_market_status",
    description: "Returns position, result, claim, and refund state.",
  },
  { name: "get_claimable_amount", description: "Returns a wallet's unclaimed winnings." },
  { name: "get_refundable_amount", description: "Returns a wallet's unclaimed refund." },
  { name: "get_market_id_by_key", description: "Finds a market by asset and UTC candle start." },
  {
    name: "validate_market_creation",
    description: "Checks whether a proposed market can be created.",
  },
  {
    name: "get_market_configuration",
    description: "Returns configured assets, limits, and sources.",
  },
  { name: "get_protocol_stats", description: "Returns owner, operator, counts, and totals." },
] as const;

export const WRITE_METHODS = [
  { name: "set_market_operator", description: "Owner-only update for the authorized operator." },
  { name: "create_market", description: "Owner/operator creation of a future one-hour market." },
  { name: "place_bet", description: "User prediction with a payable GEN stake." },
  {
    name: "settle_market",
    description: "Owner/operator trigger for contract-controlled settlement.",
  },
  { name: "claim_winnings", description: "Winning participant claim transaction." },
  {
    name: "claim_refund",
    description: "Cancelled or inconclusive participant refund transaction.",
  },
] as const;
