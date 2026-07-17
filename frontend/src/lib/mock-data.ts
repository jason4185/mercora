// Mocked contract-shaped data. Replace with GenLayer reads when wiring the contract.
// Amounts are decimal strings to mirror on-chain GEN token precision.

export type Asset = "BTC" | "ETH" | "BNB" | "SOL";
export type MarketStatus =
  | "OPEN"
  | "CLOSED"
  | "READY_FOR_SETTLEMENT"
  | "SETTLED"
  | "INCONCLUSIVE"
  | "CANCELLED";
export type Outcome = "UP" | "DOWN" | "NONE";
export type Provider = "Binance" | "Bybit" | "Gate.io" | "MEXC" | "Bitget";

export interface Evidence {
  provider: Provider;
  symbol: string;
  open: string;
  close: string;
  vote: Outcome;
  status: "OK" | "MISSING" | "INVALID";
}

export interface Market {
  id: string;
  asset: Asset;
  pair: string; // e.g. BTCUSDT
  question: string;
  openTime: number; // ms UTC — candle open (also betting-close boundary aligns here)
  closeTime: number; // ms UTC — candle close
  bettingCloseTime: number; // ms UTC — bets accepted until this instant
  settleAfterTime: number; // ms UTC — earliest settlement allowed
  status: MarketStatus;
  outcome: Outcome;
  upPool: string; // GEN, decimal string
  downPool: string;
  bettorCount: number;
  referencePrice: number; // opening price at market open (display only)
  priceSeries?: { t: number; p: number }[];
  evidence?: Evidence[];
}

export type UserPositionSide = "UP" | "DOWN" | "NONE";
export type UserMarketStatus =
  | "NOT_PARTICIPATED"
  | "PENDING"
  | "WON"
  | "LOST"
  | "REFUND_AVAILABLE"
  | "CLAIMED"
  | "REFUNDED";

export interface UserPosition {
  marketId: string;
  side: UserPositionSide;
  stake: string; // GEN
  status: UserMarketStatus;
  claimable: string; // GEN
}

export interface WalletState {
  address: string;
  balance: string; // GEN
  isOperator: boolean;
  displayName: string;
}

export type WalletMode =
  | "DISCONNECTED"
  | "REGULAR"
  | "OPERATOR"
  | "WINNER"
  | "LOSER"
  | "REFUND";

// ---- Helpers ----
const HOUR = 60 * 60 * 1000;
export const now = () => Date.now();

const hourAlign = (t: number) => Math.floor(t / HOUR) * HOUR;

function seriesAround(basePrice: number, direction: "UP" | "DOWN" | "FLAT", volatility = 0.006) {
  const points: { t: number; p: number }[] = [];
  const drift = direction === "UP" ? 1 : direction === "DOWN" ? -1 : 0;
  for (let i = 0; i <= 60; i++) {
    const noise = Math.sin(i * 0.7) * volatility * basePrice * 0.35;
    const trend = (drift * volatility * basePrice * i) / 60;
    points.push({ t: i, p: basePrice + trend + noise });
  }
  return points;
}

// ---- Markets ----
const nowH = hourAlign(now());

export const MARKETS: Market[] = [
  // LIVE / OPEN — betting still open, candle in progress
  {
    id: "m_btc_live_1",
    asset: "BTC",
    pair: "BTCUSDT",
    question: "Will BTCUSDT close higher than open for the 14:00 UTC hourly candle?",
    openTime: nowH,
    closeTime: nowH + HOUR,
    bettingCloseTime: nowH + HOUR - 60_000,
    settleAfterTime: nowH + HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "184.20",
    downPool: "126.75",
    bettorCount: 47,
    referencePrice: 71_842.5,
    priceSeries: seriesAround(71_842.5, "UP"),
  },
  {
    id: "m_eth_live_1",
    asset: "ETH",
    pair: "ETHUSDT",
    question: "Will ETHUSDT close higher than open for the 14:00 UTC hourly candle?",
    openTime: nowH,
    closeTime: nowH + HOUR,
    bettingCloseTime: nowH + HOUR - 60_000,
    settleAfterTime: nowH + HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "92.00",
    downPool: "141.50",
    bettorCount: 33,
    referencePrice: 3_842.12,
    priceSeries: seriesAround(3_842.12, "DOWN"),
  },
  {
    id: "m_sol_live_1",
    asset: "SOL",
    pair: "SOLUSDT",
    question: "Will SOLUSDT close higher than open for the 14:00 UTC hourly candle?",
    openTime: nowH,
    closeTime: nowH + HOUR,
    bettingCloseTime: nowH + HOUR - 60_000,
    settleAfterTime: nowH + HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "58.30",
    downPool: "61.10",
    bettorCount: 21,
    referencePrice: 189.44,
    priceSeries: seriesAround(189.44, "FLAT"),
  },
  {
    id: "m_bnb_live_1",
    asset: "BNB",
    pair: "BNBUSDT",
    question: "Will BNBUSDT close higher than open for the 14:00 UTC hourly candle?",
    openTime: nowH,
    closeTime: nowH + HOUR,
    bettingCloseTime: nowH + HOUR - 60_000,
    settleAfterTime: nowH + HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "37.50",
    downPool: "22.40",
    bettorCount: 14,
    referencePrice: 604.71,
    priceSeries: seriesAround(604.71, "UP"),
  },

  // UPCOMING — next hour
  {
    id: "m_btc_up_1",
    asset: "BTC",
    pair: "BTCUSDT",
    question: "Will BTCUSDT close higher than open for the 15:00 UTC hourly candle?",
    openTime: nowH + HOUR,
    closeTime: nowH + 2 * HOUR,
    bettingCloseTime: nowH + 2 * HOUR - 60_000,
    settleAfterTime: nowH + 2 * HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "12.00",
    downPool: "9.20",
    bettorCount: 6,
    referencePrice: 71_842.5,
  },
  {
    id: "m_eth_up_1",
    asset: "ETH",
    pair: "ETHUSDT",
    question: "Will ETHUSDT close higher than open for the 15:00 UTC hourly candle?",
    openTime: nowH + HOUR,
    closeTime: nowH + 2 * HOUR,
    bettingCloseTime: nowH + 2 * HOUR - 60_000,
    settleAfterTime: nowH + 2 * HOUR + 5 * 60_000,
    status: "OPEN",
    outcome: "NONE",
    upPool: "4.10",
    downPool: "6.90",
    bettorCount: 3,
    referencePrice: 3_842.12,
  },

  // READY FOR SETTLEMENT — candle closed, settle window reached
  {
    id: "m_btc_ready_1",
    asset: "BTC",
    pair: "BTCUSDT",
    question: "Will BTCUSDT close higher than open for the 13:00 UTC hourly candle?",
    openTime: nowH - HOUR,
    closeTime: nowH,
    bettingCloseTime: nowH - 60_000,
    settleAfterTime: nowH + 5 * 60_000,
    status: "READY_FOR_SETTLEMENT",
    outcome: "NONE",
    upPool: "212.40",
    downPool: "198.00",
    bettorCount: 58,
    referencePrice: 71_620.0,
    priceSeries: seriesAround(71_620, "UP"),
  },

  // SETTLED (UP)
  {
    id: "m_eth_settled_up",
    asset: "ETH",
    pair: "ETHUSDT",
    question: "Will ETHUSDT close higher than open for the 12:00 UTC hourly candle?",
    openTime: nowH - 2 * HOUR,
    closeTime: nowH - HOUR,
    bettingCloseTime: nowH - HOUR - 60_000,
    settleAfterTime: nowH - HOUR + 5 * 60_000,
    status: "SETTLED",
    outcome: "UP",
    upPool: "168.20",
    downPool: "121.40",
    bettorCount: 44,
    referencePrice: 3_812.55,
    priceSeries: seriesAround(3_812.55, "UP"),
    evidence: [
      { provider: "Binance", symbol: "ETHUSDT", open: "3812.55", close: "3831.20", vote: "UP", status: "OK" },
      { provider: "Bybit", symbol: "ETHUSDT", open: "3812.60", close: "3831.15", vote: "UP", status: "OK" },
      { provider: "Gate.io", symbol: "ETHUSDT", open: "3812.42", close: "3831.05", vote: "UP", status: "OK" },
      { provider: "MEXC", symbol: "ETHUSDT", open: "3812.70", close: "3831.30", vote: "UP", status: "OK" },
      { provider: "Bitget", symbol: "ETHUSDT", open: "3812.50", close: "3831.11", vote: "UP", status: "OK" },
    ],
  },

  // SETTLED (DOWN)
  {
    id: "m_sol_settled_down",
    asset: "SOL",
    pair: "SOLUSDT",
    question: "Will SOLUSDT close higher than open for the 11:00 UTC hourly candle?",
    openTime: nowH - 3 * HOUR,
    closeTime: nowH - 2 * HOUR,
    bettingCloseTime: nowH - 2 * HOUR - 60_000,
    settleAfterTime: nowH - 2 * HOUR + 5 * 60_000,
    status: "SETTLED",
    outcome: "DOWN",
    upPool: "44.00",
    downPool: "89.50",
    bettorCount: 27,
    referencePrice: 191.10,
    priceSeries: seriesAround(191.10, "DOWN"),
    evidence: [
      { provider: "Binance", symbol: "SOLUSDT", open: "191.10", close: "189.42", vote: "DOWN", status: "OK" },
      { provider: "Bybit", symbol: "SOLUSDT", open: "191.12", close: "189.40", vote: "DOWN", status: "OK" },
      { provider: "Gate.io", symbol: "SOLUSDT", open: "191.08", close: "189.44", vote: "DOWN", status: "OK" },
      { provider: "MEXC", symbol: "SOLUSDT", open: "191.15", close: "189.39", vote: "DOWN", status: "OK" },
      { provider: "Bitget", symbol: "SOLUSDT", open: "191.11", close: "189.45", vote: "DOWN", status: "OK" },
    ],
  },

  // INCONCLUSIVE — split votes, no 3/5 majority
  {
    id: "m_bnb_inconclusive",
    asset: "BNB",
    pair: "BNBUSDT",
    question: "Will BNBUSDT close higher than open for the 10:00 UTC hourly candle?",
    openTime: nowH - 4 * HOUR,
    closeTime: nowH - 3 * HOUR,
    bettingCloseTime: nowH - 3 * HOUR - 60_000,
    settleAfterTime: nowH - 3 * HOUR + 5 * 60_000,
    status: "INCONCLUSIVE",
    outcome: "NONE",
    upPool: "18.00",
    downPool: "21.50",
    bettorCount: 11,
    referencePrice: 601.20,
    priceSeries: seriesAround(601.20, "FLAT"),
    evidence: [
      { provider: "Binance", symbol: "BNBUSDT", open: "601.20", close: "601.25", vote: "UP", status: "OK" },
      { provider: "Bybit", symbol: "BNBUSDT", open: "601.22", close: "601.18", vote: "DOWN", status: "OK" },
      { provider: "Gate.io", symbol: "BNBUSDT", open: "601.19", close: "601.19", vote: "DOWN", status: "OK" },
      { provider: "MEXC", symbol: "BNBUSDT", open: "-", close: "-", vote: "NONE", status: "MISSING" },
      { provider: "Bitget", symbol: "BNBUSDT", open: "601.21", close: "601.23", vote: "UP", status: "OK" },
    ],
  },

  // CANCELLED — one-sided
  {
    id: "m_btc_cancelled",
    asset: "BTC",
    pair: "BTCUSDT",
    question: "Will BTCUSDT close higher than open for the 09:00 UTC hourly candle?",
    openTime: nowH - 5 * HOUR,
    closeTime: nowH - 4 * HOUR,
    bettingCloseTime: nowH - 4 * HOUR - 60_000,
    settleAfterTime: nowH - 4 * HOUR + 5 * 60_000,
    status: "CANCELLED",
    outcome: "NONE",
    upPool: "8.00",
    downPool: "0",
    bettorCount: 2,
    referencePrice: 71_020.5,
  },
];

export function getMarketById(id: string) {
  return MARKETS.find((m) => m.id === id);
}

export function impliedProbabilities(m: Market): { up: number; down: number } {
  const up = parseFloat(m.upPool);
  const down = parseFloat(m.downPool);
  const total = up + down;
  if (total <= 0) return { up: 0.5, down: 0.5 };
  return { up: up / total, down: down / total };
}

export function totalPool(m: Market) {
  return (parseFloat(m.upPool) + parseFloat(m.downPool)).toFixed(2);
}

/** Estimated pari-mutuel payout, gross of any fee (fees are shown as 0 in this mock). */
export function estimatePayout(m: Market, side: "UP" | "DOWN", stake: number) {
  const up = parseFloat(m.upPool);
  const down = parseFloat(m.downPool);
  const winning = side === "UP" ? up + stake : down + stake;
  const losing = side === "UP" ? down : up;
  if (winning <= 0) return 0;
  return stake + (stake / winning) * losing;
}

// ---- Wallet / user positions ----
export const WALLET_PROFILES: Record<Exclude<WalletMode, "DISCONNECTED">, WalletState> = {
  REGULAR: { address: "0x7A3f…9B22", balance: "42.50", isOperator: false, displayName: "Player" },
  OPERATOR: { address: "0xC001…0PER", balance: "128.00", isOperator: true, displayName: "Operator" },
  WINNER: { address: "0xW1N…001", balance: "104.25", isOperator: false, displayName: "Winner" },
  LOSER: { address: "0xL0S…002", balance: "16.75", isOperator: false, displayName: "Player" },
  REFUND: { address: "0xREF…003", balance: "37.10", isOperator: false, displayName: "Player" },
};

export function positionsForMode(mode: WalletMode): UserPosition[] {
  if (mode === "DISCONNECTED") return [];
  const base: UserPosition[] = [
    {
      marketId: "m_btc_live_1",
      side: "UP",
      stake: "2.00",
      status: "PENDING",
      claimable: "0",
    },
    {
      marketId: "m_eth_live_1",
      side: "DOWN",
      stake: "1.00",
      status: "PENDING",
      claimable: "0",
    },
  ];
  if (mode === "WINNER") {
    base.push({
      marketId: "m_eth_settled_up",
      side: "UP",
      stake: "5.00",
      status: "WON",
      claimable: "8.60",
    });
    base.push({
      marketId: "m_sol_settled_down",
      side: "DOWN",
      stake: "3.00",
      status: "CLAIMED",
      claimable: "0",
    });
  }
  if (mode === "LOSER") {
    base.push({
      marketId: "m_eth_settled_up",
      side: "DOWN",
      stake: "4.00",
      status: "LOST",
      claimable: "0",
    });
  }
  if (mode === "REFUND") {
    base.push({
      marketId: "m_bnb_inconclusive",
      side: "UP",
      stake: "2.00",
      status: "REFUND_AVAILABLE",
      claimable: "2.00",
    });
    base.push({
      marketId: "m_btc_cancelled",
      side: "UP",
      stake: "1.00",
      status: "REFUND_AVAILABLE",
      claimable: "1.00",
    });
  }
  return base;
}

// ---- Notifications ----
export interface Notification {
  id: string;
  title: string;
  body: string;
  ts: number;
  unread: boolean;
  kind: "won" | "lost" | "inconclusive" | "cancelled" | "claimed" | "info";
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "You won 8.60 GEN on ETHUSDT",
    body: "12:00 UTC candle settled UP with 5/5 source agreement.",
    ts: now() - 30 * 60_000,
    unread: true,
    kind: "won",
  },
  {
    id: "n2",
    title: "Your BNBUSDT market was inconclusive",
    body: "Fewer than 3 matching votes. Refund available.",
    ts: now() - 3 * HOUR,
    unread: true,
    kind: "inconclusive",
  },
  {
    id: "n3",
    title: "Your ETHUSDT prediction lost",
    body: "11:00 UTC candle closed lower than open.",
    ts: now() - 5 * HOUR,
    unread: false,
    kind: "lost",
  },
  {
    id: "n4",
    title: "Payout claimed",
    body: "You claimed 2.40 GEN from SOLUSDT.",
    ts: now() - 20 * HOUR,
    unread: false,
    kind: "claimed",
  },
];
