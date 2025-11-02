"use client";
import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FhevmInstance } from "./fhevmTypes";
import { createFhevmInstance, FhevmAbortError } from "./internal/fhevm";

export type FhevmGoState = "idle" | "loading" | "ready" | "error";

export function useFhevm(parameters: {
  provider: string | ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Readonly<Record<number, string>>;
}): {
  instance: FhevmInstance | undefined;
  refresh: () => void;
  error: Error | undefined;
  status: FhevmGoState;
} {
  const { provider, chainId, enabled = true, initialMockChains } = parameters;

  const [instance, _setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, _setStatus] = useState<FhevmGoState>("idle");
  const [error, _setError] = useState<Error | undefined>(undefined);

  const _abortControllerRef = useRef<AbortController | null>(null);
  const _providerRef = useRef<string | ethers.Eip1193Provider | undefined>(provider);
  const _chainIdRef = useRef<number | undefined>(chainId);
  const [_isRunning, _setIsRunning] = useState<boolean>(false);
  const [_providerChanged, _setProviderChanged] = useState<number>(0);
  const _mockChainsRef = useRef<Record<number, string>>(initialMockChains ?? {});

  useEffect(() => { _mockChainsRef.current = initialMockChains ?? {}; }, [initialMockChains]);

  const refresh = useCallback(() => {
    if (_abortControllerRef.current) {
      _abortControllerRef.current.abort();
      _abortControllerRef.current = null;
    }
    _providerRef.current = provider;
    _chainIdRef.current = chainId;
    _setInstance(undefined);
    _setError(undefined);
    _setStatus("idle");
    if (provider !== undefined) {
      _setProviderChanged((prev) => prev + 1);
    }
  }, [provider, chainId]);

  useEffect(() => {
    _providerRef.current = provider;
    _chainIdRef.current = chainId;
    if (enabled && provider !== undefined) {
      _setProviderChanged((prev) => prev + 1);
    }
  }, [provider, chainId, enabled]);

  useEffect(() => {
    if (!enabled) {
      _setIsRunning(false);
      return;
    }
    _setIsRunning(true);
  }, [enabled]);

  useEffect(() => {
    if (!_isRunning || !_providerRef.current) return;
    if (_abortControllerRef.current) {
      _abortControllerRef.current.abort();
    }
    _abortControllerRef.current = new AbortController();

    const runInitialization = async () => {
      try {
        _setStatus("loading");
        _setError(undefined);

        const newInstance = await createFhevmInstance({
          signal: _abortControllerRef.current!.signal,
          provider: _providerRef.current!,
          mockChains: _mockChainsRef.current,
          onStatusChange: (s) => console.log(`[useFhevm] status: ${s}`),
        });
        if (_abortControllerRef.current!.signal.aborted) return;
        _setInstance(newInstance);
        _setError(undefined);
        _setStatus("ready");
      } catch (e) {
        if (_abortControllerRef.current!.signal.aborted) return;
        _setInstance(undefined);
        _setError(e as Error);
        _setStatus("error");
      }
    };

    runInitialization();
    return () => {
      _abortControllerRef.current?.abort();
    };
  }, [_isRunning, _providerChanged]);

  return { instance, refresh, error, status };
}


