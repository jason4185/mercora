import type { MarketStatus, Outcome, ProtocolStats, UserMarketStatus } from "./contract-parsers";

export interface MarketCreationAvailability {
  enabled: boolean;
  reason: string;
}

export interface MarketCreationAvailabilityInput {
  connected: boolean;
  correctNetwork: boolean;
  authorizationLoading: boolean;
  authorized: boolean;
  assetSelected: boolean;
  dateSelected: boolean;
  hourSelected: boolean;
  validationLoading: boolean;
  validationError: boolean;
  validationValid: boolean;
  validationReason?: string;
  pending: boolean;
}

export function isAuthorizedAccount(
  address: string | undefined,
  stats: Pick<ProtocolStats, "owner" | "market_operator"> | undefined,
): boolean {
  if (!address || !stats) return false;
  const normalized = address.toLowerCase();
  return [stats.owner, stats.market_operator]
    .filter(Boolean)
    .some((candidate) => candidate.toLowerCase() === normalized);
}

export function utcSelectionToUnix(date: string, hour: string): bigint | null {
  const parts = date.split("-").map(Number);
  const hourNumber = Number(hour);
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isInteger(part)) ||
    !Number.isInteger(hourNumber) ||
    hourNumber < 0 ||
    hourNumber > 23
  ) {
    return null;
  }
  const [year, month, day] = parts;
  const milliseconds = Date.UTC(year, month - 1, day, hourNumber, 0, 0);
  if (!Number.isFinite(milliseconds)) return null;
  const resolved = new Date(milliseconds);
  if (
    resolved.getUTCFullYear() !== year ||
    resolved.getUTCMonth() !== month - 1 ||
    resolved.getUTCDate() !== day ||
    resolved.getUTCHours() !== hourNumber
  ) {
    return null;
  }
  return BigInt(milliseconds / 1_000);
}

export function friendlyCreationValidationReason(
  reason: string | undefined,
  leadTimeSeconds = "1800",
): string {
  const leadMinutes = BigInt(leadTimeSeconds || "0") / 60n;
  switch (reason) {
    case "VALID":
      return "This market is ready to create.";
    case "UNSUPPORTED_ASSET":
      return "Select a supported asset.";
    case "NOT_HOUR_ALIGNED":
      return "Select a full UTC start hour.";
    case "NOT_IN_FUTURE":
      return "Choose a future start time.";
    case "INSUFFICIENT_CREATION_LEAD_TIME":
      return `This market must be created earlier. Choose a time at least ${leadMinutes} minutes ahead.`;
    case "DUPLICATE_MARKET":
      return "A market already exists for this asset and time.";
    default:
      return "Market validation could not be completed. Try again.";
  }
}

export function getMarketCreationAvailability(
  input: MarketCreationAvailabilityInput,
): MarketCreationAvailability {
  if (!input.connected) return { enabled: false, reason: "Connect a browser wallet to continue." };
  if (!input.correctNetwork)
    return { enabled: false, reason: "Switch to GenLayer Bradbury to continue." };
  if (input.authorizationLoading)
    return { enabled: false, reason: "Checking account authorization…" };
  if (!input.authorized)
    return {
      enabled: false,
      reason: "Only the owner or authorized market manager can create markets.",
    };
  if (!input.assetSelected) return { enabled: false, reason: "Select an asset." };
  if (!input.dateSelected) return { enabled: false, reason: "Select a start date." };
  if (!input.hourSelected) return { enabled: false, reason: "Select a full UTC start hour." };
  if (input.validationLoading) return { enabled: false, reason: "Checking this market…" };
  if (input.validationError)
    return {
      enabled: false,
      reason: "Market validation could not be completed. Try again.",
    };
  if (!input.validationValid)
    return {
      enabled: false,
      reason: friendlyCreationValidationReason(input.validationReason),
    };
  if (input.pending) return { enabled: false, reason: "Market creation is already in progress." };
  return { enabled: true, reason: "This market is ready to create." };
}

export function duplicateMarketPath(
  validation: { reason: string; duplicate_market_id: string } | undefined,
): string | null {
  return validation?.reason === "DUPLICATE_MARKET" && validation.duplicate_market_id
    ? `/market/${validation.duplicate_market_id}`
    : null;
}

export type CollectionReadState = "loading" | "failed" | "empty" | "ready";

export function collectionReadState(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  itemCount: number;
}): CollectionReadState {
  if (input.isLoading && !input.hasData) return "loading";
  if (input.isError && !input.hasData) return "failed";
  if (input.hasData && input.itemCount === 0) return "empty";
  return "ready";
}

export function canClaimWinnings(status: UserMarketStatus | undefined): boolean {
  return userMarketResult(status).kind === "WON_CLAIMABLE";
}

export function canClaimRefund(status: UserMarketStatus | undefined): boolean {
  return userMarketResult(status).kind === "REFUND_AVAILABLE";
}

export type UserMarketResultKind =
  | "NOT_PARTICIPATED"
  | "ACTIVE"
  | "WAITING_FOR_RESULT"
  | "WON_CLAIMABLE"
  | "WON_CLAIMED"
  | "LOST"
  | "REFUND_AVAILABLE"
  | "REFUNDED";

export interface UserMarketResultInput {
  status?: UserMarketStatus;
  market?: {
    status: MarketStatus;
    outcome: Outcome;
  };
  claimableAmount?: bigint | string;
  refundableAmount?: bigint | string;
}

export interface UserMarketResult {
  kind: UserMarketResultKind;
  label: string;
  payoutLabel: string;
  payoutAmount: bigint;
  actionLabel: string;
  userDirection: "UP" | "DOWN" | "NONE";
  confirmedResult: Outcome;
  participated: boolean;
  isLost: boolean;
  message?: string;
  supportingMessage?: string;
}

function amount(value: bigint | string | undefined, fallback: string): bigint {
  return value === undefined ? BigInt(fallback) : BigInt(value);
}

function lostMessage(result: "UP" | "DOWN", direction: "UP" | "DOWN") {
  return `The confirmed result was ${result}, while you predicted ${direction}.`;
}

export function userMarketResult(
  input?: UserMarketResultInput | UserMarketStatus,
): UserMarketResult {
  const status = input && "user_result" in input ? input : input?.status;
  const market = input && "user_result" in input ? undefined : input?.market;
  const participated = Boolean(status?.participated);
  const userDirection = status?.position ?? "NONE";
  const displayStatus = market?.status ?? status?.display_status ?? "OPEN";
  const finalOutcome = market?.outcome ?? status?.final_outcome ?? "NONE";
  const claimable = amount(
    input && "user_result" in input ? undefined : input?.claimableAmount,
    status?.claimable_amount ?? "0",
  );
  const refundable = amount(
    input && "user_result" in input ? undefined : input?.refundableAmount,
    status?.refundable_amount ?? "0",
  );

  const base = {
    payoutLabel: "Payout",
    payoutAmount: claimable + refundable,
    actionLabel: "View Market",
    userDirection,
    confirmedResult: finalOutcome,
    participated,
    isLost: false,
  } satisfies Omit<UserMarketResult, "kind" | "label">;

  if (!status || !participated || userDirection === "NONE") {
    return { ...base, kind: "NOT_PARTICIPATED", label: "No position", payoutAmount: 0n };
  }

  if (
    status.user_result === "REFUNDED" ||
    (status.claimed && status.user_result === "REFUND_AVAILABLE")
  ) {
    return { ...base, kind: "REFUNDED", label: "Refunded", payoutAmount: 0n };
  }
  if (!status.claimed && refundable > 0n) {
    return {
      ...base,
      kind: "REFUND_AVAILABLE",
      label: "Refund available",
      payoutAmount: refundable,
    };
  }
  if (status.user_result === "CLAIMED" || status.claimed) {
    return {
      ...base,
      kind: "WON_CLAIMED",
      label: "Claimed",
      payoutAmount: BigInt(status.claimed_amount),
    };
  }
  if (!status.claimed && claimable > 0n) {
    return { ...base, kind: "WON_CLAIMABLE", label: "You won", payoutAmount: claimable };
  }

  const settledWithClearResult =
    displayStatus === "SETTLED" && (finalOutcome === "UP" || finalOutcome === "DOWN");
  const cancelledOrInconclusive =
    displayStatus === "CANCELLED" ||
    displayStatus === "INCONCLUSIVE" ||
    finalOutcome === "CANCELLED" ||
    finalOutcome === "INCONCLUSIVE";
  if (
    settledWithClearResult &&
    !cancelledOrInconclusive &&
    (userDirection === "UP" || userDirection === "DOWN") &&
    userDirection !== finalOutcome &&
    claimable === 0n &&
    refundable === 0n &&
    !status.claimed
  ) {
    return {
      ...base,
      kind: "LOST",
      label: "Lost",
      payoutLabel: "Final payout",
      payoutAmount: 0n,
      isLost: true,
      message: "Your prediction did not win",
      supportingMessage: lostMessage(finalOutcome, userDirection),
    };
  }

  if (["CLOSED", "READY_FOR_SETTLEMENT"].includes(displayStatus) || finalOutcome === "NONE") {
    return { ...base, kind: "WAITING_FOR_RESULT", label: "Waiting for result", payoutAmount: 0n };
  }

  return { ...base, kind: "ACTIVE", label: "Active", payoutAmount: 0n };
}
