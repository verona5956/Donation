import { isAddress, Eip1193Provider, JsonRpcProvider } from "ethers";
import type { FhevmInitSDKOptions, FhevmInitSDKType, FhevmLoadSDKType, FhevmWindowType } from "./fhevmTypes";
import { isFhevmWindowType, RelayerSDKLoader } from "./RelayerSDKLoader";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import type { FhevmInstance, FhevmInstanceConfig } from "../fhevmTypes";

export class FhevmAbortError extends Error {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}

const isFhevmInitialized = (): boolean => {
  if (!isFhevmWindowType(window)) return false;
  return (window as FhevmWindowType).relayerSDK.__initialized__ === true;
};

const fhevmLoadSDK: FhevmLoadSDKType = () => {
  const loader = new RelayerSDKLoader({ trace: console.log });
  return loader.load();
};

const fhevmInitSDK: FhevmInitSDKType = async (options?: FhevmInitSDKOptions) => {
  if (!isFhevmWindowType(window)) throw new Error("window.relayerSDK is not available");
  const result = await (window as FhevmWindowType).relayerSDK.initSDK(options);
  (window as FhevmWindowType).relayerSDK.__initialized__ = result;
  if (!result) throw new Error("window.relayerSDK.initSDK failed.");
  return true;
};

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } finally {
    rpc.destroy();
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("fhevm_relayer_metadata", []);
    return version;
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<
  | { ACLAddress: `0x${string}`; InputVerifierAddress: `0x${string}`; KMSVerifierAddress: `0x${string}` }
  | undefined
> {
  const version = await getWeb3Client(rpcUrl);
  if (typeof version !== "string" || !version.toLowerCase().includes("hardhat")) return undefined;
  try {
    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== "object") return undefined;
    if (!("ACLAddress" in metadata) || typeof (metadata as any).ACLAddress !== "string") return undefined;
    if (!("InputVerifierAddress" in metadata) || typeof (metadata as any).InputVerifierAddress !== "string") return undefined;
    if (!("KMSVerifierAddress" in metadata) || typeof (metadata as any).KMSVerifierAddress !== "string") return undefined;
    return metadata as any;
  } catch {
    return undefined;
  }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(providerOrUrl: Eip1193Provider | string, mockChains?: Record<number, string>): Promise<ResolveResult> {
  const chainId = await getChainId(providerOrUrl);
  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
  const _mockChains: Record<number, string> = { 31337: "http://localhost:8545", ...(mockChains ?? {}) };
  if (Object.prototype.hasOwnProperty.call(_mockChains, chainId)) {
    if (!rpcUrl) rpcUrl = _mockChains[chainId];
    return { isMock: true, chainId, rpcUrl };
    }
  return { isMock: false, chainId, rpcUrl };
}

export const createFhevmInstance = async (parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: "sdk-loading" | "sdk-loaded" | "sdk-initializing" | "sdk-initialized" | "creating") => void;
}): Promise<FhevmInstance> => {
  const throwIfAborted = () => { if (parameters.signal.aborted) throw new FhevmAbortError(); };
  const notify = (s: "sdk-loading" | "sdk-loaded" | "sdk-initializing" | "sdk-initialized" | "creating") => parameters.onStatusChange?.(s);

  const { provider: providerOrUrl, mockChains, signal } = parameters;
  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);

  if (isMock) {
    const meta = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
    if (meta) {
      notify("creating");
      const fhevmMock = await import("./mock/fhevmMock");
      const mockInstance = await fhevmMock.fhevmMockCreateInstance({ rpcUrl, chainId, metadata: meta });
      throwIfAborted();
      return mockInstance as unknown as FhevmInstance;
    }
  }

  throwIfAborted();
  if (!isFhevmWindowType(window)) {
    notify("sdk-loading");
    await fhevmLoadSDK();
    throwIfAborted();
    notify("sdk-loaded");
  }
  if (!isFhevmInitialized()) {
    notify("sdk-initializing");
    await fhevmInitSDK();
    throwIfAborted();
    notify("sdk-initialized");
  }

  const relayerSDK = (window as unknown as FhevmWindowType).relayerSDK;
  const aclAddress = relayerSDK.EthereumConfig.aclContractAddress;
  if (typeof aclAddress !== "string" || !isAddress(aclAddress)) throw new Error(`Invalid ACL address: ${aclAddress}`);

  const pub = await publicKeyStorageGet(aclAddress as `0x${string}`);
  throwIfAborted();

  const config: FhevmInstanceConfig = {
    ...relayerSDK.EthereumConfig,
    network: providerOrUrl,
    publicKey: pub.publicKey,
    publicParams: pub.publicParams,
  } as FhevmInstanceConfig;

  notify("creating");
  const instance = await relayerSDK.createInstance(config);

  await publicKeyStorageSet(aclAddress as `0x${string}`, instance.getPublicKey(), instance.getPublicParams(2048));
  throwIfAborted();

  return instance as FhevmInstance;
};


