import type { Eip1193Provider } from "ethers";

export interface Eip6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon?: string;
    rdns?: string;
  };
  provider: Eip1193Provider;
}

export interface Eip6963AnnounceProviderEvent extends Event {
  detail: Eip6963ProviderDetail;
}


