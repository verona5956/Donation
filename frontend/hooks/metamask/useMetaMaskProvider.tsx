import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Eip1193Provider, ethers } from "ethers";
import { useEip6963 } from "./useEip6963";

interface ProviderConnectInfo { readonly chainId: string; }
interface ProviderRpcError extends Error { message: string; code: number; data?: unknown; }

type Eip1193EventFn = <E extends "connect" | "chainChanged" | "accountsChanged" | "disconnect">(
  event: E,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: any
) => void;

interface Eip1193ProviderWithEvent extends ethers.Eip1193Provider {
  on?: Eip1193EventFn;
  off?: Eip1193EventFn;
  addListener?: Eip1193EventFn;
  removeListener?: Eip1193EventFn;
}

export interface UseMetaMaskState {
  provider: Eip1193Provider | undefined;
  chainId: number | undefined;
  accounts: string[] | undefined;
  isConnected: boolean;
  error: Error | undefined;
  connect: () => void;
}

function useMetaMaskInternal(): UseMetaMaskState {
  const { error: eip6963Error, providers } = useEip6963();
  const [_currentProvider, _setCurrentProvider] = useState<Eip1193ProviderWithEvent | undefined>(undefined);
  const [chainId, _setChainId] = useState<number | undefined>(undefined);
  const [accounts, _setAccounts] = useState<string[] | undefined>(undefined);

  const connectListenerRef = useRef<any | undefined>(undefined);
  const disconnectListenerRef = useRef<any | undefined>(undefined);
  const chainChangedListenerRef = useRef<any | undefined>(undefined);
  const accountsChangedListenerRef = useRef<any | undefined>(undefined);
  const metaMaskProviderRef = useRef<Eip1193ProviderWithEvent | undefined>(undefined);

  const hasProvider = Boolean(_currentProvider);
  const hasAccounts = (accounts?.length ?? 0) > 0;
  const hasChain = typeof chainId === "number";
  const isConnected = hasProvider && hasAccounts && hasChain;

  const connect = useCallback(() => {
    if (!_currentProvider) return;
    if (accounts && accounts.length > 0) return;
    _currentProvider.request({ method: "eth_requestAccounts" });
  }, [_currentProvider, accounts]);

  useEffect(() => {
    let next: Eip1193ProviderWithEvent | undefined = undefined;
    for (let i = 0; i < providers.length; ++i) {
      if (providers[i].info.name.toLowerCase() === "metamask") {
        next = providers[i].provider;
        break;
      }
    }

    const prev = metaMaskProviderRef.current;
    if (prev === next) return;

    if (prev) {
      if (connectListenerRef.current) { prev.off?.("connect", connectListenerRef.current); prev.removeListener?.("connect", connectListenerRef.current); connectListenerRef.current = undefined; }
      if (disconnectListenerRef.current) { prev.off?.("disconnect", disconnectListenerRef.current); prev.removeListener?.("disconnect", disconnectListenerRef.current); disconnectListenerRef.current = undefined; }
      if (chainChangedListenerRef.current) { prev.off?.("chainChanged", chainChangedListenerRef.current); prev.removeListener?.("chainChanged", chainChangedListenerRef.current); chainChangedListenerRef.current = undefined; }
      if (accountsChangedListenerRef.current) { prev.off?.("accountsChanged", accountsChangedListenerRef.current); prev.removeListener?.("accountsChanged", accountsChangedListenerRef.current); accountsChangedListenerRef.current = undefined; }
    }

    _setCurrentProvider(undefined);
    _setChainId(undefined);
    _setAccounts(undefined);
    metaMaskProviderRef.current = next;

    let nextConnectListener: any | undefined = undefined;
    let nextDisconnectListener: any | undefined = undefined;
    let nextChainChangedListener: any | undefined = undefined;
    let nextAccountsChangedListener: any | undefined = undefined;

    if (next) {
      nextConnectListener = (connectInfo: ProviderConnectInfo) => {
        if (next !== metaMaskProviderRef.current) return;
        _setCurrentProvider(next);
        _setChainId(Number.parseInt(connectInfo.chainId, 16));
      };
      nextDisconnectListener = (error: ProviderRpcError) => {
        if (next !== metaMaskProviderRef.current) return;
        _setCurrentProvider(undefined);
        _setChainId(undefined);
        _setAccounts(undefined);
      };
      nextChainChangedListener = (chainId: string) => {
        if (next !== metaMaskProviderRef.current) return;
        _setCurrentProvider(next);
        _setChainId(Number.parseInt(chainId, 16));
      };
      nextAccountsChangedListener = (accounts: string[]) => {
        if (next !== metaMaskProviderRef.current) return;
        _setCurrentProvider(next);
        _setAccounts(accounts);
      };

      if (next.on) {
        next.on("connect", nextConnectListener);
        next.on("disconnect", nextDisconnectListener);
        next.on("chainChanged", nextChainChangedListener);
        next.on("accountsChanged", nextAccountsChangedListener);
      } else {
        next.addListener?.("connect", nextConnectListener);
        next.addListener?.("disconnect", nextDisconnectListener);
        next.addListener?.("chainChanged", nextChainChangedListener);
        next.addListener?.("accountsChanged", nextAccountsChangedListener);
      }

      const updateChainId = async () => {
        if (next !== metaMaskProviderRef.current) return;
        try {
          const [chainIdHex, accountsArray] = await Promise.all([
            next.request({ method: "eth_chainId" }),
            next.request({ method: "eth_accounts" }),
          ]);
          _setCurrentProvider(next);
          _setChainId(Number.parseInt(chainIdHex as string, 16));
          _setAccounts(accountsArray as string[]);
        } catch {
          _setCurrentProvider(next);
          _setChainId(undefined);
          _setAccounts(undefined);
        }
      };
      updateChainId();
    }
  }, [providers]);

  useEffect(() => () => {
    const current = metaMaskProviderRef.current;
    if (current) {
      const chainChangedListener = chainChangedListenerRef.current;
      const accountsChangedListener = accountsChangedListenerRef.current;
      const connectListener = connectListenerRef.current;
      const disconnectListener = disconnectListenerRef.current;
      if (connectListener) { current.off?.("connect", connectListener); current.removeListener?.("connect", connectListener); }
      if (disconnectListener) { current.off?.("disconnect", disconnectListener); current.removeListener?.("disconnect", disconnectListener); }
      if (chainChangedListener) { current.off?.("chainChanged", chainChangedListener); current.removeListener?.("chainChanged", chainChangedListener); }
      if (accountsChangedListener) { current.off?.("accountsChanged", accountsChangedListener); current.removeListener?.("accountsChanged", accountsChangedListener); }
    }
    chainChangedListenerRef.current = undefined;
    metaMaskProviderRef.current = undefined;
  }, []);

  return { provider: _currentProvider, chainId, accounts, isConnected, error: eip6963Error, connect };
}

interface MetaMaskProviderProps { children: ReactNode }
const MetaMaskContext = createContext<UseMetaMaskState | undefined>(undefined);

export const MetaMaskProvider: React.FC<MetaMaskProviderProps> = ({ children }) => {
  const { provider, chainId, accounts, isConnected, error, connect } = useMetaMaskInternal();
  return (
    <MetaMaskContext.Provider value={{ provider, chainId, accounts, isConnected, error, connect }}>
      {children}
    </MetaMaskContext.Provider>
  );
};

export function useMetaMask() {
  const context = useContext(MetaMaskContext);
  if (context === undefined) throw new Error("useMetaMask must be used within a MetaMaskProvider");
  return context;
}


