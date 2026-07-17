import { weiToGen } from "./contract-parsers";
import { userMarketResult } from "./contract-ui";
import type { MarketView } from "./market-view";
import type { UserMarketStatus } from "./contract-parsers";

export type ContractNotification = {
  id: string;
  marketId: string;
  title: string;
  body: string;
  timestamp: Date;
  kind: "won" | "refund" | "claimed" | "closing" | "started" | "ready" | "result" | "lost";
};

export type ContractNotificationRow = {
  market: MarketView;
  user: UserMarketStatus;
};

export function contractNotifications(
  rows: ContractNotificationRow[],
  address = "",
): ContractNotification[] {
  const now = Math.floor(Date.now() / 1_000);
  const owner = address.toLowerCase();
  return rows
    .map(({ market, user }) => {
      const pair = market.pair;
      const timestamp = new Date(
        market.resolvedAt ||
          Number(market.contract.created_at || market.contract.candle_start) * 1_000,
      );
      const result = userMarketResult({
        status: user,
        market: { status: market.status, outcome: market.outcome },
      });
      if (
        result.kind === "LOST" &&
        (result.confirmedResult === "UP" || result.confirmedResult === "DOWN") &&
        (result.userDirection === "UP" || result.userDirection === "DOWN")
      ) {
        return {
          id: `${owner}-${market.id}-lost`,
          marketId: market.id,
          title: "Market Result Confirmed",
          body: `The result was ${result.confirmedResult}. Your ${result.userDirection} prediction did not win.`,
          timestamp,
          kind: "lost" as const,
        };
      }
      if (user.user_result === "WON") {
        return {
          id: `${owner}-${market.id}-won`,
          marketId: market.id,
          title: "Winnings Available",
          body: `You won ${weiToGen(user.claimable_amount)} GEN on ${pair}. Your winnings are ready to claim.`,
          timestamp,
          kind: "won" as const,
        };
      }
      if (user.user_result === "REFUND_AVAILABLE") {
        return {
          id: `${owner}-${market.id}-refund`,
          marketId: market.id,
          title: "Refund Available",
          body: `${pair} ended without a confirmed result. Your refund is ready to claim.`,
          timestamp,
          kind: "refund" as const,
        };
      }
      if (user.user_result === "CLAIMED") {
        return {
          id: `${owner}-${market.id}-claimed`,
          marketId: market.id,
          title: "Winnings Claimed",
          body: `Your ${pair} winnings claim was completed successfully.`,
          timestamp,
          kind: "claimed" as const,
        };
      }
      if (user.user_result === "REFUNDED") {
        return {
          id: `${owner}-${market.id}-refunded`,
          marketId: market.id,
          title: "Refund Claimed",
          body: `Your ${pair} refund claim was completed successfully.`,
          timestamp,
          kind: "claimed" as const,
        };
      }
      if (market.status === "READY_FOR_SETTLEMENT") {
        return {
          id: `${owner}-${market.id}-ready`,
          marketId: market.id,
          title: "Market Ready for Result",
          body: `${pair} is ready for its final prices to be checked.`,
          timestamp: new Date(market.settleAfterTime),
          kind: "ready" as const,
        };
      }
      if (
        (market.status === "CLOSED" || market.status === "OPEN") &&
        Date.now() >= market.openTime
      ) {
        return {
          id: `${owner}-${market.id}-started`,
          marketId: market.id,
          title: "Price Period Started",
          body: `The one-hour price period for ${pair} has started. Betting is closed.`,
          timestamp: new Date(market.openTime),
          kind: "started" as const,
        };
      }
      if (
        market.status === "OPEN" &&
        Math.floor(market.bettingCloseTime / 1_000) - now > 0 &&
        Math.floor(market.bettingCloseTime / 1_000) - now <= 900
      ) {
        return {
          id: `${owner}-${market.id}-closing`,
          marketId: market.id,
          title: "Betting Closes Soon",
          body: `Betting on ${pair} closes soon.`,
          timestamp: new Date(market.bettingCloseTime),
          kind: "closing" as const,
        };
      }
      if (market.status === "SETTLED") {
        return {
          id: `${owner}-${market.id}-result`,
          marketId: market.id,
          title: "Result Confirmed",
          body: `${pair} finished ${market.outcome}. The final result is now available.`,
          timestamp,
          kind: "result" as const,
        };
      }
      return null;
    })
    .filter((item): item is ContractNotification => item !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12);
}
