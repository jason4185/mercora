import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/mercora";
import {
  genToWei,
  parseIdPage,
  parseMarket,
  parseMarketLookup,
  parseUserMarketStatus,
  WEI_PER_GEN,
  type UserMarketStatus,
} from "./contract-parsers";
import {
  canClaimRefund,
  canClaimWinnings,
  collectionReadState,
  duplicateMarketPath,
  getMarketCreationAvailability,
  isAuthorizedAccount,
  utcSelectionToUnix,
  userMarketResult,
} from "./contract-ui";
import { marketPageReadMethod, mercoraCalls, SubmittedTransactionError } from "./mercora-contract";
import {
  contractRateLimitRetryDelay,
  contractReadQueryPolicy,
  contractReadCooldownRemaining,
  contractReadRetryDelay,
  isContractRateLimitError,
  shouldRetryContractRead,
} from "./contract-read-policy";
import {
  claimStateMatches,
  predictionStateMatches,
  reconcileContractState,
  reconcileCreatedMarket,
} from "./reconciliation";
import {
  marketDetailQuestion,
  participantLabel,
  poolDisplay,
  shortMarketQuestion,
  toMarketView,
} from "./market-view";
import {
  isOpenPortfolioPosition,
  portfolioSummary,
  type PortfolioSummaryEntry,
} from "./portfolio-summary";
import { formatCompactUtcWindow } from "./format";
import { contractNotifications } from "./notifications";
import {
  amountRefetchInterval,
  contractPolling,
  invalidateAfterMarketCreation,
  invalidateAfterUserWrite,
  isMercoraUserQueryKey,
  marketListRefetchInterval,
  marketRefetchInterval,
  portfolioRefetchInterval,
  userStatusRefetchInterval,
} from "./contract-refresh-policy";
import {
  resolveSelectedWalletProviderForWrite,
  walletErrorMessage,
  type WalletWriteInput,
} from "./wallet-write";
import { mercoraKeys } from "@/hooks/contract/use-mercora";
import {
  DOC_SECTIONS,
  HOW_IT_WORKS_STEPS,
  MARKET_DOCS,
  PRODUCTION_LINKS,
  READ_METHODS,
  SETTLEMENT_PROVIDERS,
  WRITE_METHODS,
} from "./product-docs";
import type { EIP1193Provider } from "viem";
import type { Connector } from "wagmi";

const marketFixture = {
  market_id: "4",
  market_key: "BTC:1H:1784304000",
  created_by: "0x0000000000000000000000000000000000000001",
  asset: "BTC",
  pair: "BTCUSDT",
  category: "CRYPTO",
  market_type: "ONE_HOUR_DIRECTION",
  quote_asset: "USDT",
  interval: "1H",
  timezone: "UTC",
  question: "Will Bitcoin finish higher?",
  up_label: "UP",
  down_label: "DOWN",
  up_rule: "close > open",
  down_rule: "close <= open",
  betting_close: "1784304000",
  candle_start: "1784304000",
  candle_end: "1784307600",
  settle_after: "1784307720",
  created_at: "1784300000",
  resolved_at: "0",
  status: "OPEN",
  final_outcome: "NONE",
  total_up_pool: "1000000000000000000",
  total_down_pool: "0",
  total_pool: "1000000000000000000",
  number_of_bettors: "1",
  settlement: {
    final_outcome: "NONE",
    valid_source_count: 0,
    up_votes: 0,
    down_votes: 0,
    unavailable_votes: 0,
    sources: {},
    reason: "NOT_SETTLED",
  },
};

function providerWithState(input: {
  accounts: string[];
  chainId?: number;
  name?: "MetaMask" | "Rabby";
  rejectSwitch?: boolean;
  unknownBeforeAdd?: boolean;
}) {
  let chainId = input.chainId ?? wagmiConfig.chains[0].id;
  let switchCalls = 0;
  let addCalls = 0;
  const calls: string[] = [];
  const provider = {
    isMetaMask: input.name === "MetaMask" || undefined,
    isRabby: input.name === "Rabby" || undefined,
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      calls.push(method);
      if (method === "eth_accounts") return input.accounts;
      if (method === "eth_chainId") return `0x${chainId.toString(16)}`;
      if (method === "wallet_switchEthereumChain") {
        switchCalls += 1;
        if (input.rejectSwitch) throw { code: 4001, message: "User rejected" };
        if (input.unknownBeforeAdd && addCalls === 0)
          throw { code: 4902, message: "Unknown chain" };
        const target = params?.[0] as { chainId?: string };
        chainId = Number.parseInt(target.chainId ?? "0x0", 16);
        return null;
      }
      if (method === "wallet_addEthereumChain") {
        addCalls += 1;
        const target = params?.[0] as { chainId?: string };
        chainId = Number.parseInt(target.chainId ?? "0x0", 16);
        return null;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  } as EIP1193Provider & { isMetaMask?: true; isRabby?: true };
  return {
    provider,
    calls,
    get switchCalls() {
      return switchCalls;
    },
    get addCalls() {
      return addCalls;
    },
  };
}

function connectorForProvider(provider: EIP1193Provider, name = "MetaMask") {
  return {
    id: name.toLowerCase(),
    name,
    getProvider: async () => provider,
  } as Connector;
}

async function routeSource(fileName: string) {
  return Bun.file(new URL(`../routes/${fileName}`, import.meta.url)).text();
}

function walletInput(provider: EIP1193Provider, address: string): WalletWriteInput {
  return {
    connector: connectorForProvider(provider),
    address: address as `0x${string}`,
    chainId: wagmiConfig.chains[0].id,
    operation: "placeBet",
    functionName: "place_bet",
    args: [4n, "UP"],
    value: genToWei("1"),
  };
}

function userStatus(overrides: Partial<UserMarketStatus> = {}): UserMarketStatus {
  return {
    market_id: "4",
    wallet: "0x0000000000000000000000000000000000000003",
    participated: true,
    position: "UP",
    up_stake: WEI_PER_GEN.toString(),
    down_stake: "0",
    total_stake: WEI_PER_GEN.toString(),
    market_status: "SETTLED",
    display_status: "SETTLED",
    final_outcome: "UP",
    user_result: "WON",
    claimable_amount: (2n * WEI_PER_GEN).toString(),
    refundable_amount: "0",
    claimed: false,
    claimed_amount: "0",
    ...overrides,
  };
}

function settledMarket(outcome: "UP" | "DOWN" | "INCONCLUSIVE" | "CANCELLED" = "UP") {
  const status =
    outcome === "INCONCLUSIVE" ? "INCONCLUSIVE" : outcome === "CANCELLED" ? "CANCELLED" : "SETTLED";
  return toMarketView(
    parseMarket(
      {
        ...marketFixture,
        status,
        final_outcome: outcome,
        resolved_at: "1784308000",
        settlement: {
          ...marketFixture.settlement,
          final_outcome: outcome,
          valid_source_count: outcome === "UP" || outcome === "DOWN" ? 5 : 2,
          up_votes: outcome === "UP" ? 5 : 0,
          down_votes: outcome === "DOWN" ? 5 : 0,
          reason: outcome === "INCONCLUSIVE" ? "NO_CONSENSUS" : "SETTLED",
          sources:
            outcome === "UP" || outcome === "DOWN"
              ? {
                  BINANCE: {
                    status: "VALID",
                    open: "100",
                    close: outcome === "UP" ? "101" : "99",
                    direction: outcome,
                  },
                }
              : {},
        },
      },
      status,
    ),
    { up_bps: "5000", down_bps: "5000" },
  );
}

function portfolioEntry({
  marketId = "4",
  displayStatus = "OPEN",
  finalOutcome = "NONE",
  user = {},
}: {
  marketId?: string;
  displayStatus?: PortfolioSummaryEntry["market"]["status"];
  finalOutcome?: PortfolioSummaryEntry["market"]["outcome"];
  user?: Partial<UserMarketStatus>;
} = {}): PortfolioSummaryEntry {
  const storedStatus =
    displayStatus === "SETTLED" || displayStatus === "INCONCLUSIVE" || displayStatus === "CANCELLED"
      ? displayStatus
      : "OPEN";
  return {
    market: toMarketView(
      parseMarket(
        {
          ...marketFixture,
          market_id: marketId,
          status: storedStatus,
          final_outcome: finalOutcome,
        },
        displayStatus,
      ),
    ),
    user: userStatus({
      market_id: marketId,
      market_status: storedStatus,
      display_status: displayStatus,
      final_outcome: finalOutcome,
      user_result: "PENDING",
      claimable_amount: "0",
      refundable_amount: "0",
      claimed: false,
      claimed_amount: "0",
      ...user,
    }),
  };
}

describe("exact GEN conversion", () => {
  test("converts whole and fractional GEN without Number", () => {
    expect(genToWei("1")).toBe(WEI_PER_GEN);
    expect(genToWei("1.000000000000000001")).toBe(WEI_PER_GEN + 1n);
  });

  test("supports exactly 18 decimal places", () => {
    expect(genToWei("0.000000000000000001")).toBe(1n);
  });

  test("rejects excess precision, zero, negatives, and invalid text", () => {
    expect(() => genToWei("1.0000000000000000001")).toThrow();
    expect(() => genToWei("0")).toThrow();
    expect(() => genToWei("-1")).toThrow();
    expect(() => genToWei("one")).toThrow();
  });
});

describe("contract response parsing", () => {
  test("parses JSON-string and decoded ID pages", () => {
    const expected = { market_ids: ["5", "4"], next_cursor: "2", has_more: true };
    expect(parseIdPage(JSON.stringify(expected))).toEqual(expected);
    expect(parseIdPage(expected)).toEqual(expected);
  });

  test("parses market status using the authoritative display status", () => {
    expect(parseMarket(JSON.stringify(marketFixture), "CLOSED").display_status).toBe("CLOSED");
  });

  test("parses connected-user result states", () => {
    expect(parseUserMarketStatus(JSON.stringify(userStatus())).user_result).toBe("WON");
  });

  test("parses post-creation market lookup", () => {
    expect(parseMarketLookup('{"exists":true,"market_id":"24"}')).toEqual({
      exists: true,
      market_id: "24",
    });
  });
});

describe("contract-backed action eligibility", () => {
  test("enables winnings only for an unclaimed positive amount", () => {
    expect(canClaimWinnings(userStatus())).toBe(true);
    expect(canClaimWinnings(userStatus({ claimed: true }))).toBe(false);
    expect(canClaimWinnings(userStatus({ claimable_amount: "0" }))).toBe(false);
  });

  test("enables refunds only for an unclaimed positive amount", () => {
    const refundable = userStatus({
      market_status: "INCONCLUSIVE",
      display_status: "INCONCLUSIVE",
      final_outcome: "INCONCLUSIVE",
      user_result: "REFUND_AVAILABLE",
      claimable_amount: "0",
      refundable_amount: WEI_PER_GEN.toString(),
    });
    expect(canClaimRefund(refundable)).toBe(true);
    expect(canClaimRefund({ ...refundable, claimed: true })).toBe(false);
  });
});

describe("centralized connected-user result mapping", () => {
  test("UP participant loses when the confirmed result is DOWN", () => {
    const result = userMarketResult(
      userStatus({
        position: "UP",
        display_status: "SETTLED",
        final_outcome: "DOWN",
        user_result: "LOST",
        claimable_amount: "0",
        refundable_amount: "0",
      }),
    );
    expect(result.kind).toBe("LOST");
    expect(result.label).toBe("Lost");
    expect(result.message).toBe("Your prediction did not win");
    expect(result.supportingMessage).toBe("The confirmed result was DOWN, while you predicted UP.");
    expect(result.payoutLabel).toBe("Final payout");
    expect(result.payoutAmount).toBe(0n);
  });

  test("DOWN participant loses when the confirmed result is UP", () => {
    const result = userMarketResult(
      userStatus({
        position: "DOWN",
        display_status: "SETTLED",
        final_outcome: "UP",
        user_result: "LOST",
        claimable_amount: "0",
        refundable_amount: "0",
      }),
    );
    expect(result.kind).toBe("LOST");
    expect(result.supportingMessage).toBe("The confirmed result was UP, while you predicted DOWN.");
  });

  test("losing position shows Lost, 0 GEN, and no claim or refund action", () => {
    const status = userStatus({
      display_status: "SETTLED",
      final_outcome: "DOWN",
      user_result: "LOST",
      claimable_amount: "0",
      refundable_amount: "0",
    });
    const result = userMarketResult(status);
    expect(result.kind).toBe("LOST");
    expect(result.label).toBe("Lost");
    expect(result.payoutAmount).toBe(0n);
    expect(canClaimWinnings(status)).toBe(false);
    expect(canClaimRefund(status)).toBe(false);
    expect(result.actionLabel).toBe("View Market");
  });

  test("winning and claimed winning positions are not marked Lost", () => {
    expect(userMarketResult(userStatus()).kind).toBe("WON_CLAIMABLE");
    expect(
      userMarketResult(
        userStatus({
          user_result: "CLAIMED",
          claimed: true,
          claimable_amount: "0",
          claimed_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("WON_CLAIMED");
  });

  test("cancelled, inconclusive, refundable, non-participant, and waiting markets are not Lost", () => {
    expect(
      userMarketResult(
        userStatus({
          display_status: "CANCELLED",
          final_outcome: "CANCELLED",
          user_result: "REFUND_AVAILABLE",
          claimable_amount: "0",
          refundable_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("REFUND_AVAILABLE");
    expect(
      userMarketResult(
        userStatus({
          display_status: "INCONCLUSIVE",
          final_outcome: "INCONCLUSIVE",
          user_result: "REFUND_AVAILABLE",
          claimable_amount: "0",
          refundable_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("REFUND_AVAILABLE");
    expect(
      userMarketResult(
        userStatus({
          participated: false,
          position: "NONE",
          user_result: "NOT_PARTICIPATED",
          claimable_amount: "0",
        }),
      ).kind,
    ).toBe("NOT_PARTICIPATED");
    expect(
      userMarketResult(
        userStatus({
          display_status: "READY_FOR_SETTLEMENT",
          final_outcome: "NONE",
          user_result: "PENDING",
          claimable_amount: "0",
        }),
      ).kind,
    ).toBe("WAITING_FOR_RESULT");
  });

  test("centralized user-result priority prefers refunds and claimed winnings before Lost", () => {
    expect(
      userMarketResult(
        userStatus({
          display_status: "SETTLED",
          final_outcome: "DOWN",
          user_result: "REFUNDED",
          claimable_amount: "0",
          refundable_amount: "0",
        }),
      ).kind,
    ).toBe("REFUNDED");
    expect(
      userMarketResult(
        userStatus({
          display_status: "SETTLED",
          final_outcome: "DOWN",
          user_result: "REFUND_AVAILABLE",
          claimable_amount: "0",
          refundable_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("REFUND_AVAILABLE");
    expect(
      userMarketResult(
        userStatus({
          display_status: "SETTLED",
          final_outcome: "DOWN",
          user_result: "CLAIMED",
          claimed: true,
          claimable_amount: "0",
          claimed_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("WON_CLAIMED");
  });

  test("temporary read failure can preserve the last successful losing state", () => {
    const client = new QueryClient();
    const key = ["user-status", "4"];
    const lost = userStatus({
      display_status: "SETTLED",
      final_outcome: "DOWN",
      user_result: "LOST",
      claimable_amount: "0",
      refundable_amount: "0",
    });
    client.setQueryData(key, lost);
    expect(userMarketResult(client.getQueryData<UserMarketStatus>(key)).kind).toBe("LOST");
  });

  test("market-card personal result appears only for participating users", () => {
    expect(userMarketResult(userStatus()).participated).toBe(true);
    expect(
      userMarketResult(
        userStatus({
          participated: false,
          position: "NONE",
          user_result: "NOT_PARTICIPATED",
          claimable_amount: "0",
        }),
      ).participated,
    ).toBe(false);
  });
});

describe("contract-backed losing notifications", () => {
  test("generates a linked losing notification from contract-backed status", () => {
    const market = settledMarket("DOWN");
    const notifications = contractNotifications(
      [
        {
          market,
          user: userStatus({
            position: "UP",
            display_status: "SETTLED",
            final_outcome: "DOWN",
            user_result: "LOST",
            claimable_amount: "0",
            refundable_amount: "0",
          }),
        },
      ],
      "0x0000000000000000000000000000000000000003",
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.id).toBe("0x0000000000000000000000000000000000000003-4-lost");
    expect(notifications[0]?.marketId).toBe("4");
    expect(notifications[0]?.title).toBe("Market Result Confirmed");
    expect(notifications[0]?.body).toBe("The result was DOWN. Your UP prediction did not win.");
  });

  test("does not duplicate losing notifications continuously", () => {
    const market = settledMarket("UP");
    const row = {
      market,
      user: userStatus({
        position: "DOWN",
        display_status: "SETTLED",
        final_outcome: "UP",
        user_result: "LOST",
        claimable_amount: "0",
        refundable_amount: "0",
      }),
    };
    const first = contractNotifications([row], "0x0000000000000000000000000000000000000003");
    const second = contractNotifications([row], "0x0000000000000000000000000000000000000003");
    expect(first.map((item) => item.id)).toEqual([
      "0x0000000000000000000000000000000000000003-4-lost",
    ]);
    expect(second.map((item) => item.id)).toEqual([
      "0x0000000000000000000000000000000000000003-4-lost",
    ]);
  });
});

describe("Portfolio summary", () => {
  test("positive-stake Waiting for result row counts as one open position", () => {
    const row = portfolioEntry({ displayStatus: "READY_FOR_SETTLEMENT" });
    expect(userMarketResult({ status: row.user, market: row.market }).kind).toBe(
      "WAITING_FOR_RESULT",
    );
    expect(portfolioSummary([row]).openPositions).toBe(1);
  });

  test("betting-open unresolved row counts as open", () => {
    const row = portfolioEntry({ displayStatus: "OPEN" });
    expect(isOpenPortfolioPosition(row)).toBe(true);
    expect(portfolioSummary([row]).openPositions).toBe(1);
  });

  test("betting-closed but unresolved row counts as open", () => {
    const row = portfolioEntry({ displayStatus: "CLOSED" });
    expect(isOpenPortfolioPosition(row)).toBe(true);
    expect(portfolioSummary([row]).openPositions).toBe(1);
  });

  test("settlement-pending row counts as open", () => {
    const row = portfolioEntry({ displayStatus: "READY_FOR_SETTLEMENT" });
    expect(isOpenPortfolioPosition(row)).toBe(true);
    expect(portfolioSummary([row]).openPositions).toBe(1);
  });

  test("won but unclaimed position does not count as open", () => {
    const row = portfolioEntry({
      displayStatus: "SETTLED",
      finalOutcome: "UP",
      user: { user_result: "WON", claimable_amount: "0" },
    });
    expect(isOpenPortfolioPosition(row)).toBe(false);
    expect(portfolioSummary([row]).openPositions).toBe(0);
  });

  test("lost position does not count as open", () => {
    const row = portfolioEntry({
      displayStatus: "SETTLED",
      finalOutcome: "DOWN",
      user: { user_result: "LOST" },
    });
    expect(isOpenPortfolioPosition(row)).toBe(false);
    expect(portfolioSummary([row]).openPositions).toBe(0);
  });

  test("claimable winning position contributes to winnings, not open positions", () => {
    const row = portfolioEntry({
      displayStatus: "SETTLED",
      finalOutcome: "UP",
      user: {
        user_result: "WON",
        claimable_amount: (2n * WEI_PER_GEN).toString(),
      },
    });
    const summary = portfolioSummary([row]);
    expect(summary.openPositions).toBe(0);
    expect(summary.winnings).toBe(2n * WEI_PER_GEN);
  });

  test("refundable position contributes to refunds, not open positions", () => {
    const row = portfolioEntry({
      displayStatus: "INCONCLUSIVE",
      finalOutcome: "INCONCLUSIVE",
      user: {
        user_result: "REFUND_AVAILABLE",
        refundable_amount: WEI_PER_GEN.toString(),
      },
    });
    const summary = portfolioSummary([row]);
    expect(summary.openPositions).toBe(0);
    expect(summary.refunds).toBe(WEI_PER_GEN);
  });

  test("claimed position does not count as open", () => {
    const row = portfolioEntry({
      displayStatus: "SETTLED",
      finalOutcome: "UP",
      user: {
        user_result: "CLAIMED",
        claimed: true,
        claimed_amount: (2n * WEI_PER_GEN).toString(),
      },
    });
    expect(isOpenPortfolioPosition(row)).toBe(false);
    expect(portfolioSummary([row]).openPositions).toBe(0);
  });

  test("multiple unresolved positions produce the correct count", () => {
    const entries = [
      portfolioEntry({ marketId: "4", displayStatus: "OPEN" }),
      portfolioEntry({ marketId: "5", displayStatus: "CLOSED" }),
      portfolioEntry({ marketId: "6", displayStatus: "READY_FOR_SETTLEMENT" }),
      portfolioEntry({
        marketId: "7",
        displayStatus: "SETTLED",
        finalOutcome: "DOWN",
        user: { user_result: "LOST" },
      }),
    ];
    expect(portfolioSummary(entries).openPositions).toBe(3);
  });

  test("zero-stake rows do not count", () => {
    const row = portfolioEntry({
      displayStatus: "OPEN",
      user: {
        total_stake: "0",
        up_stake: "0",
      },
    });
    expect(isOpenPortfolioPosition(row)).toBe(false);
    expect(portfolioSummary([row]).openPositions).toBe(0);
  });

  test("summary uses existing Portfolio data without introducing a new contract read", async () => {
    const source = await routeSource("portfolio.tsx");
    const pageSection = source.slice(0, source.indexOf("function PositionAction"));
    expect(pageSection).toContain("portfolioSummary(entries)");
    expect(pageSection.match(/= useUserPortfolio\(/g)?.length).toBe(1);
    expect(pageSection).not.toContain("useClaimableAmount");
    expect(pageSection).not.toContain("useRefundableAmount");
    expect(pageSection).not.toContain("getClaimableAmount");
    expect(pageSection).not.toContain("getRefundableAmount");
  });

  test("summary preserves total staked while counting open positions", () => {
    const summary = portfolioSummary([
      portfolioEntry({ marketId: "4", displayStatus: "OPEN" }),
      portfolioEntry({
        marketId: "5",
        displayStatus: "SETTLED",
        finalOutcome: "DOWN",
        user: { user_result: "LOST", total_stake: (3n * WEI_PER_GEN).toString() },
      }),
    ]);
    expect(summary.openPositions).toBe(1);
    expect(summary.totalStaked).toBe(4n * WEI_PER_GEN);
  });
});

describe("automatic contract refresh policy", () => {
  test("active and waiting markets refetch quickly while completed markets slow down", () => {
    expect(marketRefetchInterval("OPEN")).toBe(contractPolling.activeMarket);
    expect(marketRefetchInterval("CLOSED")).toBe(contractPolling.activeMarket);
    expect(marketRefetchInterval("READY_FOR_SETTLEMENT")).toBe(contractPolling.activeMarket);
    expect(marketRefetchInterval("SETTLED")).toBe(contractPolling.finalMarket);
    expect(marketListRefetchInterval("completed")).toBe(contractPolling.completedMarketList);
    expect(marketListRefetchInterval("due")).toBe(contractPolling.dueMarketList);
  });

  test("connected-user results poll quickly until the final user state is stable", () => {
    expect(userStatusRefetchInterval(userStatus({ user_result: "PENDING" }))).toBe(
      contractPolling.activeUser,
    );
    expect(
      userStatusRefetchInterval(
        userStatus({
          display_status: "SETTLED",
          final_outcome: "DOWN",
          user_result: "LOST",
          claimable_amount: "0",
          refundable_amount: "0",
        }),
      ),
    ).toBe(contractPolling.stableUser);
    expect(
      portfolioRefetchInterval([
        {
          user: userStatus({
            display_status: "READY_FOR_SETTLEMENT",
            final_outcome: "NONE",
            user_result: "PENDING",
          }),
        },
      ]),
    ).toBe(contractPolling.activeUser);
  });

  test("claim and refund availability poll quickly while actions may appear after contract data changes", () => {
    expect(amountRefetchInterval({ amount: 0n, fast: true, marketStatus: "SETTLED" })).toBe(
      contractPolling.activeUser,
    );
    expect(
      amountRefetchInterval({ amount: WEI_PER_GEN, fast: false, marketStatus: "SETTLED" }),
    ).toBe(contractPolling.activeUser);
    expect(amountRefetchInterval({ amount: 0n, fast: false, marketStatus: "SETTLED" })).toBe(
      contractPolling.stableUser,
    );
  });

  test("final result, evidence, portfolio, and notifications can update from mocked contract reads without reload", async () => {
    const waiting = settledMarket("UP");
    waiting.status = "READY_FOR_SETTLEMENT";
    waiting.outcome = "NONE";
    waiting.evidence = [];
    const final = settledMarket("DOWN");
    const reads = [waiting, final];
    const client = new QueryClient();
    const key = mercoraKeys.market("4");
    await client.fetchQuery({ queryKey: key, queryFn: async () => reads.shift()! });
    expect(client.getQueryData<typeof waiting>(key)?.status).toBe("READY_FOR_SETTLEMENT");
    await client.fetchQuery({ queryKey: key, queryFn: async () => reads.shift()!, staleTime: 0 });
    const updated = client.getQueryData<typeof final>(key);
    expect(updated?.status).toBe("SETTLED");
    expect(updated?.outcome).toBe("DOWN");
    expect(updated?.evidence.length).toBeGreaterThan(0);
  });

  test("Portfolio transitions from waiting to won, lost, and refund available from mocked status reads", () => {
    expect(
      userMarketResult(
        userStatus({
          display_status: "READY_FOR_SETTLEMENT",
          user_result: "PENDING",
          final_outcome: "NONE",
          claimable_amount: "0",
          refundable_amount: "0",
        }),
      ).kind,
    ).toBe("WAITING_FOR_RESULT");
    expect(userMarketResult(userStatus()).kind).toBe("WON_CLAIMABLE");
    expect(
      userMarketResult(
        userStatus({
          display_status: "SETTLED",
          final_outcome: "DOWN",
          user_result: "LOST",
          claimable_amount: "0",
          refundable_amount: "0",
        }),
      ).kind,
    ).toBe("LOST");
    expect(
      userMarketResult(
        userStatus({
          display_status: "INCONCLUSIVE",
          final_outcome: "INCONCLUSIVE",
          user_result: "REFUND_AVAILABLE",
          claimable_amount: "0",
          refundable_amount: WEI_PER_GEN.toString(),
        }),
      ).kind,
    ).toBe("REFUND_AVAILABLE");
  });

  test("query keys include network, contract, market, address, page size, and remain stable", () => {
    expect(mercoraKeys.markets("all", 12)).toEqual(mercoraKeys.markets("all", 12));
    expect(mercoraKeys.markets("all", 12)).not.toEqual(mercoraKeys.markets("all", 24));
    expect(mercoraKeys.userStatus("4", "0xABC")).toContain("0xabc");
    expect(isMercoraUserQueryKey(mercoraKeys.userStatus("4", "0xABC"), "0xabc")).toBe(true);
    expect(isMercoraUserQueryKey(mercoraKeys.userStatus("4", "0xABC"), "0xdef")).toBe(false);
  });

  test("focus and reconnect policy are enabled for contract reads", () => {
    expect(contractReadQueryPolicy.refetchOnWindowFocus).toBe(true);
    expect(contractReadQueryPolicy.refetchOnReconnect).toBe(true);
    expect(contractReadQueryPolicy.refetchOnMount).toBe(true);
  });

  test("transaction confirmation invalidates affected market, user, portfolio, notification, and amount queries", async () => {
    const client = new QueryClient();
    const address = "0x0000000000000000000000000000000000000003";
    const keys = [
      mercoraKeys.market("4"),
      mercoraKeys.markets("all"),
      mercoraKeys.user(address),
      mercoraKeys.userStatus("4", address),
      mercoraKeys.claimable("4", address),
      mercoraKeys.refundable("4", address),
    ];
    keys.forEach((key) => client.setQueryData(key, "loaded"));
    await invalidateAfterUserWrite(client, mercoraKeys, { marketId: "4", address });
    expect(keys.every((key) => client.getQueryState(key)?.isInvalidated)).toBe(true);
  });

  test("market creation invalidates list, stats, lookup, validation, and new detail queries", async () => {
    const client = new QueryClient();
    const candleStart = 1_784_304_000n;
    const keys = [
      mercoraKeys.stats,
      mercoraKeys.markets("all"),
      mercoraKeys.markets("active"),
      mercoraKeys.markets("due"),
      mercoraKeys.markets("completed"),
      mercoraKeys.lookup("BTC", candleStart),
      mercoraKeys.validation("BTC", candleStart),
      mercoraKeys.market("4"),
    ];
    keys.forEach((key) => client.setQueryData(key, "loaded"));
    await invalidateAfterMarketCreation(client, mercoraKeys, {
      marketId: "4",
      asset: "BTC",
      candleStart,
    });
    expect(keys.every((key) => client.getQueryState(key)?.isInvalidated)).toBe(true);
  });

  test("balance refresh is requested after prediction, claim, and refund confirmations", async () => {
    let refreshes = 0;
    const refreshBalance = () => {
      refreshes += 1;
    };
    ["prediction", "winnings", "refund"].forEach(refreshBalance);
    expect(refreshes).toBe(3);
  });
});

describe("admin and network setup", () => {
  const stats = {
    owner: "0x0000000000000000000000000000000000000001",
    market_operator: "0x0000000000000000000000000000000000000002",
  };

  test("authorizes owner and operator case-insensitively", () => {
    expect(isAuthorizedAccount(stats.owner.toUpperCase(), stats)).toBe(true);
    expect(isAuthorizedAccount(stats.market_operator, stats)).toBe(true);
  });

  test("authorizes the owner when the market operator is empty", () => {
    expect(
      isAuthorizedAccount(stats.owner, {
        owner: stats.owner,
        market_operator: "",
      }),
    ).toBe(true);
  });

  test("hides admin access from unrelated accounts", () => {
    expect(isAuthorizedAccount("0x0000000000000000000000000000000000000003", stats)).toBe(false);
  });

  test("converts a full-hour selection with Date.UTC", () => {
    const seconds = utcSelectionToUnix("2026-07-20", "14");
    expect(seconds).toBe(BigInt(Date.UTC(2026, 6, 20, 14, 0, 0) / 1_000));
    expect(seconds! < 100_000_000_000n).toBe(true);
    expect(utcSelectionToUnix("2026-02-31", "14")).toBeNull();
  });

  test("configures only one injected connector", () => {
    expect(wagmiConfig.connectors).toHaveLength(1);
    expect(wagmiConfig.connectors[0]?.id.toLowerCase()).toContain("injected");
    expect(wagmiConfig.connectors[0]?.id.toLowerCase()).not.toContain("walletconnect");
  });
});

describe("Create Market interaction", () => {
  const validInput = {
    connected: true,
    correctNetwork: true,
    authorizationLoading: false,
    authorized: true,
    assetSelected: true,
    dateSelected: true,
    hourSelected: true,
    validationLoading: false,
    validationError: false,
    validationValid: true,
    validationReason: "VALID",
    pending: false,
  };

  test("stays disabled until date and contract validation are available", () => {
    expect(getMarketCreationAvailability({ ...validInput, dateSelected: false }).reason).toBe(
      "Select a start date.",
    );
    expect(
      getMarketCreationAvailability({
        ...validInput,
        validationLoading: true,
        validationValid: false,
      }).enabled,
    ).toBe(false);
  });

  test("enables only after a valid contract response", () => {
    expect(getMarketCreationAvailability(validInput)).toEqual({
      enabled: true,
      reason: "This market is ready to create.",
    });
    expect(
      getMarketCreationAvailability({
        ...validInput,
        validationValid: false,
        validationReason: "INSUFFICIENT_CREATION_LEAD_TIME",
      }).reason,
    ).toContain("Choose a time");
  });

  test("prevents duplicate clicks while a write is pending", () => {
    expect(getMarketCreationAvailability({ ...validInput, pending: true }).enabled).toBe(false);
  });

  test("uses the exact create_market argument order with Unix seconds", () => {
    const start = 1_784_556_000n;
    expect(mercoraCalls.createMarket("BTC", start)).toEqual({
      functionName: "create_market",
      args: ["BTC", start],
      value: 0n,
    });
  });

  test("links to an existing duplicate market", () => {
    expect(duplicateMarketPath({ reason: "DUPLICATE_MARKET", duplicate_market_id: "24" })).toBe(
      "/market/24",
    );
    expect(duplicateMarketPath({ reason: "VALID", duplicate_market_id: "" })).toBeNull();
  });
});

describe("production contract mapping", () => {
  test("maps each market view to the correct deployed read", () => {
    expect(marketPageReadMethod).toEqual({
      all: "get_market_ids",
      active: "get_active_market_ids",
      due: "get_due_market_ids",
      completed: "get_completed_market_ids",
    });
  });

  test("contains no WalletConnect configuration or production mock import", async () => {
    const config = await Bun.file(new URL("../config/mercora.ts", import.meta.url)).text();
    const routes = await Promise.all(
      ["index.tsx", "market.$id.tsx", "portfolio.tsx", "admin.tsx"].map((name) =>
        Bun.file(new URL(`../routes/${name}`, import.meta.url)).text(),
      ),
    );
    expect(config.toLowerCase()).not.toContain("walletconnect");
    expect(routes.join("\n")).not.toMatch(/from\s+["'][^"']*(mock|fixture)/i);
  });
});

describe("user-facing documentation", () => {
  test("wires production links and removes stale placeholders", async () => {
    const docs = await routeSource("docs.tsx");
    const howItWorks = await routeSource("how-it-works.tsx");
    const combined = `${docs}\n${howItWorks}`;

    expect(PRODUCTION_LINKS.liveApp).toBe("https://mercora-omega.vercel.app/");
    expect(PRODUCTION_LINKS.contractAddress).toBe("0x0A3Fcc4671b6fF0BffBCDab3B744CFf6d5c7ED05");
    expect(PRODUCTION_LINKS.contractSource).toBe(
      "https://github.com/jason4185/mercora/blob/main/contract/MercoraMarket.py",
    );
    expect(PRODUCTION_LINKS.githubRepository).toBe("https://github.com/jason4185/mercora");
    expect(PRODUCTION_LINKS.settlementWorker).toBe(
      "https://mercora-settlement-worker.jxson-parametrix.workers.dev/health",
    );
    expect(PRODUCTION_LINKS.technicalDocs).toBe("https://github.com/jason4185/mercora#readme");
    expect(PRODUCTION_LINKS.explorerBaseUrl).toContain("explorer-bradbury.genlayer.com");
    expect(combined).not.toContain("Not configured");
  });

  test("documents deployed market assets, timing, limits, and result rules", async () => {
    const docs = await routeSource("docs.tsx");
    const howItWorks = await routeSource("how-it-works.tsx");

    expect(MARKET_DOCS.supportedAssets).toEqual(["BTC", "ETH", "BNB", "SOL"]);
    expect(MARKET_DOCS.quoteAsset).toBe("USDT");
    expect(MARKET_DOCS.marketPeriod).toBe("One exact UTC hour");
    expect(MARKET_DOCS.minimumStakeGen).toBe("1");
    expect(MARKET_DOCS.maximumStakeGen).toBe("10");
    expect(MARKET_DOCS.requiredVotes).toBe(3);
    expect(MARKET_DOCS.sourceCount).toBe(5);
    expect(MARKET_DOCS.settlementSafetyDelaySeconds).toBe(120);
    expect(MARKET_DOCS.workerGraceSeconds).toBe(180);
    expect(SETTLEMENT_PROVIDERS).toEqual(["Binance", "Bybit", "Gate.io", "MEXC", "Bitget"]);
    expect(docs).toContain("Arbitrary custom questions are not supported.");
    expect(docs).toContain("Close is strictly greater than open.");
    expect(docs).toContain("Close is equal to or lower than open.");
    expect(howItWorks).toContain("closes strictly higher than it opened");
    expect(howItWorks).toContain("closes equal to or lower than it opened");
  });

  test("states three-of-five settlement without implying unanimity", async () => {
    const docs = await routeSource("docs.tsx");
    const howItWorks = await routeSource("how-it-works.tsx");
    const combined = `${docs}\n${howItWorks}`;

    expect(docs).toContain("five completed candles");
    expect(docs).toContain("No side reaches 3");
    expect(HOW_IT_WORKS_STEPS.join("\n")).toContain("three matching directions");
    expect(combined).not.toMatch(/checks agree|all checks must agree|all 5 exchanges agreed/i);
  });

  test("documents cancelled, inconclusive, claims, and permissions accurately", async () => {
    const docs = await routeSource("docs.tsx");

    expect(docs).toContain("empty or only one side has a pool");
    expect(docs).toContain("does not produce at least three matching UP or DOWN votes");
    expect(docs).toContain("No clear result (Inconclusive)");
    expect(docs).toContain("Claims are manual contract transactions.");
    expect(docs).toContain("Claims cannot be repeated.");
    expect(docs).toContain("Losing users see");
    expect(docs).toContain("Owner or configured market operator can create markets.");
    expect(docs).toContain("Owner or configured market operator can call settlement.");
    expect(docs).toContain("Only the owner can change the market operator.");
    expect(docs).toContain(
      "Neither owner nor operator can submit source prices or choose the outcome.",
    );
    expect(docs).toContain("The Worker does not submit prices or choose UP/DOWN.");
  });

  test("keeps developer methods collapsed and off the How It Works page", async () => {
    const docs = await routeSource("docs.tsx");
    const howItWorks = await routeSource("how-it-works.tsx");
    const methodNames = [...READ_METHODS, ...WRITE_METHODS].map((method) => method.name);

    expect(docs).toContain("<details");
    expect(docs).toContain("Read Methods");
    expect(docs).toContain("Write Methods");
    expect(DOC_SECTIONS.map((section) => section.label)).toContain("Developer Reference");
    expect(READ_METHODS.map((method) => method.name)).toContain("get_market");
    expect(WRITE_METHODS.map((method) => method.name)).toContain("claim_refund");
    methodNames.forEach((method) => {
      expect(howItWorks).not.toContain(method);
    });
  });

  test("uses grouped exchange architecture without provider-specific crossing edges", async () => {
    const docs = await routeSource("docs.tsx");

    expect(docs).toContain('data-testid="grouped-exchange-sources"');
    expect(docs).toContain("Five Exchange Sources");
    SETTLEMENT_PROVIDERS.forEach((provider) => {
      expect(docs).not.toMatch(new RegExp(`${provider}\\s*(?:->|=>|-->|->>|→)`));
    });
  });

  test("keeps documentation navigation stable and active", async () => {
    const docs = await routeSource("docs.tsx");
    const ids = DOC_SECTIONS.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(DOC_SECTIONS.map((section) => section.label)).toEqual([
      "How Mercora Works",
      "Supported Markets",
      "Market Timeline",
      "Prediction Limits",
      "Pool Probabilities and Payouts",
      "How Prices Are Checked",
      "How GenLayer Confirms Results",
      "Cancelled and Inconclusive Markets",
      "Winnings and Refunds",
      "Market Permissions",
      "Trust and Safety",
      "Production Links",
      "Developer Reference",
    ]);
    expect(docs).toContain("document.getElementById(section.id)");
    expect(docs).toContain('aria-current={active === section.id ? "page" : undefined}');
    expect(docs).toContain("scroll-mt-28");
  });

  test("does not run contract reads on documentation load", async () => {
    const docs = await routeSource("docs.tsx");
    const howItWorks = await routeSource("how-it-works.tsx");
    const combined = `${docs}\n${howItWorks}`;

    expect(combined).not.toContain("useMarketConfiguration");
    expect(combined).not.toContain("useProtocolStats");
    expect(combined).not.toContain("useMarketPages");
    expect(combined).not.toContain("mercoraContract");
    expect(combined).not.toContain("ContractRefreshWarning");
  });
});

describe("contract read reliability", () => {
  test("retries a temporary read and succeeds", async () => {
    let attempts = 0;
    const client = new QueryClient();
    const value = await client.fetchQuery({
      queryKey: ["temporary-read"],
      queryFn: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("RPC timeout");
        return "loaded";
      },
      retry: shouldRetryContractRead,
      retryDelay: () => 0,
    });
    expect(value).toBe("loaded");
    expect(attempts).toBe(3);
    expect(contractReadRetryDelay(0)).toBe(1_000);
    expect(contractReadRetryDelay(2)).toBe(4_000);
  });

  test("uses extended cooldown and jitter for rate-limit responses", () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const error = new Error("GenLayer RPC error (gen_call): rate limit exceeded");
      expect(isContractRateLimitError(error)).toBe(true);
      expect(shouldRetryContractRead(3, error)).toBe(true);
      expect(contractRateLimitRetryDelay(0)).toBe(15_000);
      expect(contractReadCooldownRemaining()).toBeGreaterThan(0);
    } finally {
      Math.random = originalRandom;
    }
  });

  test("does not retry a permanent read error", async () => {
    let attempts = 0;
    const client = new QueryClient();
    await expect(
      client.fetchQuery({
        queryKey: ["permanent-read"],
        queryFn: async () => {
          attempts += 1;
          throw new Error("Unsupported asset");
        },
        retry: shouldRetryContractRead,
        retryDelay: () => 0,
      }),
    ).rejects.toThrow("Unsupported asset");
    expect(attempts).toBe(1);
  });

  test("preserves the last successful data after a refresh failure", async () => {
    const client = new QueryClient();
    client.setQueryData(["markets"], ["24"]);
    await expect(
      client.fetchQuery({
        queryKey: ["markets"],
        queryFn: async () => {
          throw new Error("Temporary network error");
        },
        retry: false,
        staleTime: 0,
      }),
    ).rejects.toThrow();
    expect(client.getQueryData<string[]>(["markets"])).toEqual(["24"]);
  });

  test("distinguishes initial failure from a successful empty result", () => {
    expect(
      collectionReadState({ isLoading: false, isError: true, hasData: false, itemCount: 0 }),
    ).toBe("failed");
    expect(
      collectionReadState({ isLoading: false, isError: false, hasData: true, itemCount: 0 }),
    ).toBe("empty");
  });
});

describe("selected wallet write pipeline", () => {
  const account = "0x00000000000000000000000000000000000000a1";

  test("uses the selected MetaMask provider instead of a global injected provider", async () => {
    const selected = providerWithState({ accounts: [account], name: "MetaMask" });
    const other = providerWithState({
      accounts: ["0x00000000000000000000000000000000000000b2"],
      name: "Rabby",
    });
    globalThis.window = { ethereum: other.provider } as typeof globalThis.window;
    const provider = await resolveSelectedWalletProviderForWrite(
      walletInput(selected.provider, account),
    );
    expect(provider).toBe(selected.provider);
    expect(selected.calls).toContain("eth_accounts");
    expect(other.calls).toEqual([]);
  });

  test("uses the selected Rabby provider when Rabby is selected", async () => {
    const rabby = providerWithState({ accounts: [account], name: "Rabby" });
    const provider = await resolveSelectedWalletProviderForWrite(
      walletInput(rabby.provider, account),
    );
    expect(provider).toBe(rabby.provider);
  });

  test("stops before submission when the provider account does not match", async () => {
    const metamask = providerWithState({
      accounts: ["0x00000000000000000000000000000000000000ff"],
      name: "MetaMask",
    });
    await expect(
      resolveSelectedWalletProviderForWrite(walletInput(metamask.provider, account)),
    ).rejects.toThrow("selected wallet does not match");
    expect(metamask.calls).not.toContain("eth_sendTransaction");
  });

  test("switches to Bradbury and adds the chain when the wallet reports it as unknown", async () => {
    const wallet = providerWithState({
      accounts: [account],
      chainId: 1,
      name: "MetaMask",
      unknownBeforeAdd: true,
    });
    const provider = await resolveSelectedWalletProviderForWrite(
      walletInput(wallet.provider, account),
    );
    expect(provider).toBe(wallet.provider);
    expect(wallet.switchCalls).toBe(1);
    expect(wallet.addCalls).toBe(1);
  });

  test("maps rejected network switch and MetaMask parser errors to useful messages", () => {
    expect(walletErrorMessage({ code: 4001, message: "User rejected the request" })).toBe(
      "Wallet request rejected.",
    );
    expect(
      walletErrorMessage(
        new Error("json: cannot unmarshal string into Go struct field Request.id of type int"),
      ),
    ).toContain("could not submit the transaction");
  });

  test("keeps payable prediction values as bigint", () => {
    const call = mercoraCalls.placeBet(4n, "UP", genToWei("1.25"));
    expect(typeof call.value).toBe("bigint");
    expect(call.value).toBe(1_250_000_000_000_000_000n);
  });
});

describe("post-transaction reconciliation", () => {
  const instantClock = () => {
    let time = 0;
    return {
      now: () => time,
      wait: async (milliseconds: number) => {
        time += milliseconds;
      },
    };
  };

  test("waits for a delayed market-key lookup without another write", async () => {
    let lookups = 0;
    let createCalls = 0;
    const createMarket = () => {
      createCalls += 1;
    };
    createMarket();
    const clock = instantClock();
    const result = await reconcileCreatedMarket(
      {
        getMarketIdByKey: async () => {
          lookups += 1;
          return lookups < 3 ? { exists: false, market_id: "" } : { exists: true, market_id: "24" };
        },
        marketExists: async () => true,
        getMarket: async () => ({ market_id: "24" }),
      },
      "BTC",
      1_784_556_000n,
      { timeoutMs: 10_000, intervalMs: 1_000, ...clock },
    );
    expect(result.matched).toBe(true);
    expect(result.value).toBe("24");
    expect(lookups).toBe(3);
    expect(createCalls).toBe(1);
  });

  test("retrieves a delayed duplicate market", async () => {
    let lookups = 0;
    const clock = instantClock();
    const result = await reconcileCreatedMarket(
      {
        getMarketIdByKey: async () => ({
          exists: ++lookups > 1,
          market_id: lookups > 1 ? "8" : "",
        }),
        marketExists: async () => true,
        getMarket: async () => ({ market_id: "8" }),
      },
      "ETH",
      1_784_559_600n,
      { timeoutMs: 5_000, intervalMs: 1_000, ...clock },
    );
    expect(result.value).toBe("8");
  });

  test("supports a safe manual Check Again after an initial timeout", async () => {
    let visible = false;
    let clock = instantClock();
    const first = await reconcileContractState({
      read: async () => visible,
      matches: Boolean,
      timeoutMs: 1_000,
      intervalMs: 1_000,
      ...clock,
    });
    expect(first.matched).toBe(false);
    visible = true;
    clock = instantClock();
    const second = await reconcileContractState({
      read: async () => visible,
      matches: Boolean,
      timeoutMs: 1_000,
      intervalMs: 1_000,
      ...clock,
    });
    expect(second.matched).toBe(true);
  });

  test("matches post-bet, post-claim, and post-refund state", () => {
    expect(
      predictionStateMatches(
        {
          user: { position: "UP", total_stake: "200" },
          market: { total_pool: "500" },
        },
        { position: "UP", minimumStake: 200n, minimumPool: 500n },
      ),
    ).toBe(true);
    expect(claimStateMatches({ user_result: "CLAIMED", amount: 0n }, "winnings")).toBe(true);
    expect(claimStateMatches({ user_result: "REFUNDED", amount: 0n }, "refund")).toBe(true);
  });

  test("preserves a submitted transaction hash", () => {
    const hash = `0x${"1234567890abcdef".repeat(4)}` as import("genlayer-js/types").TransactionHash;
    expect(new SubmittedTransactionError(hash).hash).toBe(hash);
  });
});

describe("market presentation helpers", () => {
  test("creates short questions for every supported asset", () => {
    expect(shortMarketQuestion("BTC")).toBe("Will Bitcoin finish higher than it started?");
    expect(shortMarketQuestion("ETH")).toBe("Will Ethereum finish higher than it started?");
    expect(shortMarketQuestion("BNB")).toBe("Will BNB finish higher than it started?");
    expect(shortMarketQuestion("SOL")).toBe("Will Solana finish higher than it started?");
  });

  test("formats card time separately in UTC and a full detail question", () => {
    const start = Date.UTC(2026, 6, 17, 14);
    const end = Date.UTC(2026, 6, 17, 15);
    expect(formatCompactUtcWindow(start, end)).toBe("17 Jul 2026 · 14:00–15:00 UTC");
    expect(marketDetailQuestion({ asset: "BNB", openTime: start, closeTime: end })).toBe(
      "Will BNB finish higher than it started between 14:00 and 15:00 UTC on 17 July 2026?",
    );
  });

  test("shows an empty pool as 0% / 0% and preserves one-sided pools", () => {
    expect(poolDisplay("0", "0", { up_bps: "0", down_bps: "10000" })).toEqual({
      upPercent: 0,
      downPercent: 0,
      hasPredictions: false,
    });
    expect(poolDisplay("10", "0", { up_bps: "10000", down_bps: "0" })).toEqual({
      upPercent: 100,
      downPercent: 0,
      hasPredictions: true,
    });
    expect(poolDisplay("0", "10", { up_bps: "0", down_bps: "10000" })).toEqual({
      upPercent: 0,
      downPercent: 100,
      hasPredictions: true,
    });
    expect(poolDisplay("10", "10", { up_bps: "5000", down_bps: "5000" })).toEqual({
      upPercent: 50,
      downPercent: 50,
      hasPredictions: true,
    });
  });

  test("derives market percentages from contract pool totals without a probability read", () => {
    const view = toMarketView(
      parseMarket({
        ...marketFixture,
        total_up_pool: "3000000000000000000",
        total_down_pool: "1000000000000000000",
        total_pool: "4000000000000000000",
      }),
    );
    expect(view.upPercent).toBe(75);
    expect(view.downPercent).toBe(25);
    expect(view.hasPredictions).toBe(true);
  });

  test("formats singular and plural participant labels", () => {
    expect(participantLabel(0)).toBe("0 participants");
    expect(participantLabel(1)).toBe("1 participant");
    expect(participantLabel(2)).toBe("2 participants");
  });
});
