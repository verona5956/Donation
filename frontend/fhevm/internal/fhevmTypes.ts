export type FhevmRelayerSDKType = {
  __initialized__?: boolean;
  initSDK: (options?: { baseUrl?: string }) => Promise<boolean>;
  createInstance: (config: any) => Promise<any>;
  EthereumConfig: any;
};

export type FhevmWindowType = Window & { relayerSDK: FhevmRelayerSDKType };

export type FhevmInitSDKOptions = { baseUrl?: string };
export type FhevmLoadSDKType = () => Promise<void>;
export type FhevmInitSDKType = (options?: FhevmInitSDKOptions) => Promise<boolean>;


