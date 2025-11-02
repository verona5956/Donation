import { ethers } from "ethers";
import type { FhevmInstance } from "./fhevmTypes";
import type { GenericStringStorage } from "./GenericStringStorage";
import type { EIP712Type, FhevmDecryptionSignatureType } from "./fhevmTypes";

class FhevmDecryptionSignatureStorageKey {
  key: string;
  constructor(instance: FhevmInstance, contractAddresses: string[], userAddress: string, publicKey?: string) {
    const base = `fhevm:decrypt:${userAddress}:${contractAddresses.join(',')}`;
    this.key = publicKey ? `${base}:${publicKey}` : base;
  }
}

export class FhevmDecryptionSignature {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;

  constructor(parameters: FhevmDecryptionSignatureType) {
    this.publicKey = parameters.publicKey;
    this.privateKey = parameters.privateKey;
    this.signature = parameters.signature;
    this.startTimestamp = parameters.startTimestamp;
    this.durationDays = parameters.durationDays;
    this.userAddress = parameters.userAddress;
    this.contractAddresses = parameters.contractAddresses;
    this.eip712 = parameters.eip712;
  }

  isValid(): boolean {
    return Date.now() / 1000 < this.startTimestamp + this.durationDays * 24 * 60 * 60;
  }

  static fromJSON(json: string): FhevmDecryptionSignature {
    const o = JSON.parse(json);
    return new FhevmDecryptionSignature(o);
  }

  toJSON(): string {
    return JSON.stringify({
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      signature: this.signature,
      startTimestamp: this.startTimestamp,
      durationDays: this.durationDays,
      userAddress: this.userAddress,
      contractAddresses: this.contractAddresses,
      eip712: this.eip712,
    });
  }

  async saveToGenericStringStorage(storage: GenericStringStorage, instance: FhevmInstance, includePublicKeyInKey: boolean): Promise<void> {
    const storageKey = new FhevmDecryptionSignatureStorageKey(instance, this.contractAddresses, this.userAddress, includePublicKeyInKey ? this.publicKey : undefined);
    await storage.setItem(storageKey.key, this.toJSON());
  }

  static async loadFromGenericStringStorage(
    storage: GenericStringStorage,
    instance: FhevmInstance,
    contractAddresses: string[],
    userAddress: string,
    publicKey?: string
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const storageKey = new FhevmDecryptionSignatureStorageKey(instance, contractAddresses, userAddress, publicKey);
      const result = await storage.getItem(storageKey.key);
      if (!result) return null;
      const kps = FhevmDecryptionSignature.fromJSON(result);
      return kps.isValid() ? kps : null;
    } catch {
      return null;
    }
  }

  static async new(
    instance: FhevmInstance,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;

      const eip712 = instance.createEIP712(publicKey, contractAddresses, startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      return new FhevmDecryptionSignature({
        publicKey,
        privateKey,
        contractAddresses: contractAddresses as `0x${string}`[],
        startTimestamp,
        durationDays,
        signature,
        eip712: eip712 as EIP712Type,
        userAddress,
      });
    } catch {
      return null;
    }
  }

  static async loadOrSign(
    instance: FhevmInstance,
    contractAddresses: string[],
    signer: ethers.Signer,
    storage: GenericStringStorage,
    keyPair?: { publicKey: string; privateKey: string }
  ): Promise<FhevmDecryptionSignature | null> {
    const userAddress = (await signer.getAddress()) as `0x${string}`;
    const cached = await FhevmDecryptionSignature.loadFromGenericStringStorage(storage, instance, contractAddresses, userAddress, keyPair?.publicKey);
    if (cached) return cached;
    const { publicKey, privateKey } = keyPair ?? instance.generateKeypair();
    const sig = await FhevmDecryptionSignature.new(instance, contractAddresses, publicKey, privateKey, signer);
    if (!sig) return null;
    await sig.saveToGenericStringStorage(storage, instance, Boolean(keyPair?.publicKey));
    return sig;
  }
}


