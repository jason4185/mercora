import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  WALLET_PROFILES,
  positionsForMode,
  type UserPosition,
  type WalletMode,
  type WalletState,
} from "./mock-data";

interface WalletCtx {
  mode: WalletMode;
  setMode: (m: WalletMode) => void;
  wallet: WalletState | null;
  positions: UserPosition[];
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("REGULAR");
  const value = useMemo<WalletCtx>(() => {
    const wallet = mode === "DISCONNECTED" ? null : WALLET_PROFILES[mode];
    return { mode, setMode, wallet, positions: positionsForMode(mode) };
  }, [mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used inside WalletProvider");
  return c;
}
