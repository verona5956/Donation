"use client";
import { ethers } from "ethers";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringInMemoryStorage } from "@/fhevm/GenericStringStorage";

import { DonationAddresses } from "@/abi/DonationAddresses";
import { DonationABI } from "@/abi/DonationABI";
import { DonationDeployInfo } from "@/abi/DonationDeployInfo";

export type ClearValueType = { handle: string; clear: string | bigint | boolean };

type DonationContractInfo = {
  abi: typeof DonationABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getDonationByChainId(chainId: number | undefined): DonationContractInfo {
  if (!chainId) return { abi: DonationABI.abi };
  const entry = DonationAddresses[chainId.toString() as keyof typeof DonationAddresses];
  if (!("address" in entry) || entry.address === ethers.ZeroAddress) return { abi: DonationABI.abi, chainId };
  return { address: entry?.address as `0x${string}` | undefined, chainId: entry?.chainId ?? chainId, chainName: entry?.chainName, abi: DonationABI.abi };
}

export const useDonation = (parameters: {
  instance: FhevmInstance | undefined;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<(ethersSigner: ethers.JsonRpcSigner | undefined) => boolean>;
}) => {
  const { instance, chainId, ethersSigner, ethersReadonlyProvider, sameChain, sameSigner } = parameters;
  const storage = useMemo(() => new GenericStringInMemoryStorage(), []);

  const [message, setMessage] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deployerAddress, setDeployerAddress] = useState<string | undefined>(undefined);
  const [projectOwner, setProjectOwner] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [lastCreatedProjectId, setLastCreatedProjectId] = useState<number | undefined>(undefined);

  const [projectTotalHandle, setProjectTotalHandle] = useState<string | undefined>(undefined);
  const [projectTotalClear, setProjectTotalClear] = useState<string | bigint | boolean | undefined>(undefined);
  const projectTotalRef = useRef<ClearValueType | undefined>(undefined);

  const [myDonationHandle, setMyDonationHandle] = useState<string | undefined>(undefined);
  const [myDonationClear, setMyDonationClear] = useState<string | bigint | boolean | undefined>(undefined);
  const myDonationRef = useRef<ClearValueType | undefined>(undefined);

  const donation = useMemo(() => getDonationByChainId(chainId), [chainId]);
  const isDeployed = useMemo(() => (Boolean(donation.address) && donation.address !== ethers.ZeroAddress), [donation]);

  const canGetProjectTotal = useMemo(() => donation.address && ethersReadonlyProvider && !isRefreshing, [donation.address, ethersReadonlyProvider, isRefreshing]);
  const canGetMyDonation = useMemo(() => donation.address && ethersReadonlyProvider && ethersSigner && !isRefreshing, [donation.address, ethersReadonlyProvider, ethersSigner, isRefreshing]);
  const isProjectOwner = useMemo(() => {
    if (!ethersSigner?.address || !projectOwner) return false;
    return projectOwner.toLowerCase() === ethersSigner.address.toLowerCase();
  }, [ethersSigner?.address, projectOwner]);
  const canDecryptProjectTotal = useMemo(() => donation.address && instance && ethersSigner && !isRefreshing && !isDecrypting && projectTotalHandle && projectTotalHandle !== ethers.ZeroHash && projectTotalHandle !== projectTotalRef.current?.handle && isProjectOwner, [donation.address, instance, ethersSigner, isRefreshing, isDecrypting, projectTotalHandle, isProjectOwner]);
  const canDecryptMyDonation = useMemo(() => donation.address && instance && ethersSigner && !isRefreshing && !isDecrypting && myDonationHandle && myDonationHandle !== ethers.ZeroHash && myDonationHandle !== myDonationRef.current?.handle, [donation.address, instance, ethersSigner, isRefreshing, isDecrypting, myDonationHandle]);

  const refreshProjectTotal = useCallback((projectId: number) => {
    if (isRefreshing || !donation.address || !ethersReadonlyProvider || !projectId) return;
    setIsRefreshing(true);
    const thisAddress = donation.address;
    const thisChainId = donation.chainId;
    const contract = new ethers.Contract(thisAddress, donation.abi, ethersReadonlyProvider);
    Promise.all([
      contract.getProjectTotal(projectId).then((value: string) => {
        if (sameChain.current(thisChainId) && thisAddress === donation.address) {
          setProjectTotalHandle(value);
        }
      }),
      contract.getProjectInfo(projectId).then((info: any) => {
        const name = (info?.name ?? info?.[0]) as string | undefined;
        const owner = (info?.owner ?? info?.[1]) as string | undefined;
        if (sameChain.current(thisChainId) && thisAddress === donation.address) {
          setProjectName(name);
          setProjectOwner(owner);
        }
      }),
    ])
      .finally(() => setIsRefreshing(false));
  }, [donation.address, donation.abi, donation.chainId, ethersReadonlyProvider, isRefreshing, sameChain]);

  const refreshMyDonation = useCallback((projectId: number) => {
    if (isRefreshing || !donation.address || !ethersReadonlyProvider || !ethersSigner || !projectId) return;
    setIsRefreshing(true);
    const thisAddress = donation.address;
    const thisChainId = donation.chainId;
    const contract = new ethers.Contract(thisAddress, donation.abi, ethersReadonlyProvider);
    contract
      .getDonationOf(projectId, ethersSigner.address)
      .then((value: string) => {
        if (sameChain.current(thisChainId) && thisAddress === donation.address) {
          setMyDonationHandle(value);
        }
      })
      .finally(() => setIsRefreshing(false));
  }, [donation.address, donation.abi, donation.chainId, ethersReadonlyProvider, ethersSigner, isRefreshing, sameChain]);

  const decryptProjectTotal = useCallback(async () => {
    if (!donation.address || !instance || !ethersSigner || !projectTotalHandle) return;
    setIsDecrypting(true);
    try {
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, [donation.address as `0x${string}`], ethersSigner, storage);
      if (!sig) return;
      const res = await instance.userDecrypt([{ handle: projectTotalHandle, contractAddress: donation.address }], sig.privateKey, sig.publicKey, sig.signature, sig.contractAddresses, sig.userAddress, sig.startTimestamp, sig.durationDays) as Record<string, string | bigint | boolean>;
      setProjectTotalClear(res[projectTotalHandle]);
      projectTotalRef.current = { handle: projectTotalHandle, clear: res[projectTotalHandle] };
    } finally {
      setIsDecrypting(false);
    }
  }, [donation.address, instance, ethersSigner, projectTotalHandle, storage]);

  const decryptMyDonation = useCallback(async () => {
    if (!donation.address || !instance || !ethersSigner || !myDonationHandle) return;
    setIsDecrypting(true);
    try {
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, [donation.address as `0x${string}`], ethersSigner, storage);
      if (!sig) return;
      const res = await instance.userDecrypt([{ handle: myDonationHandle, contractAddress: donation.address }], sig.privateKey, sig.publicKey, sig.signature, sig.contractAddresses, sig.userAddress, sig.startTimestamp, sig.durationDays) as Record<string, string | bigint | boolean>;
      setMyDonationClear(res[myDonationHandle]);
      myDonationRef.current = { handle: myDonationHandle, clear: res[myDonationHandle] };
    } finally {
      setIsDecrypting(false);
    }
  }, [donation.address, instance, ethersSigner, myDonationHandle, storage]);

  const donate = useCallback(async (projectId: number, amount: number) => {
    if (isSubmitting || !donation.address || !instance || !ethersSigner || amount <= 0 || !projectId) return;
    setIsSubmitting(true);
    const thisAddress = donation.address;
    const contract = new ethers.Contract(thisAddress, donation.abi, ethersSigner);
    try {
      const input = instance.createEncryptedInput(thisAddress, ethersSigner.address);
      input.add64(BigInt(amount));
      await new Promise((r) => setTimeout(r, 100));
      const enc = await input.encrypt();
      const tx = await contract.donate(projectId, enc.handles[0], enc.inputProof);
      await tx.wait();
      setMessage(`Donation submitted successfully! Transaction: ${tx.hash}`);
      refreshProjectTotal(projectId);
      refreshMyDonation(projectId);
    } catch (e) {
      setMessage(`Failed to submit donation. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [donation.address, donation.abi, instance, ethersSigner, isSubmitting, refreshProjectTotal, refreshMyDonation]);

  const createProject = useCallback(async (name: string) => {
    if (isSubmitting || !donation.address || !ethersSigner || !name) return;
    setIsSubmitting(true);
    try {
      const contract = new ethers.Contract(donation.address, donation.abi, ethersSigner);
      const tx = await contract.createProject(name);
      const receipt = await tx.wait();
      let newId: number | undefined = undefined;
      try {
        for (const log of receipt?.logs ?? []) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === "ProjectCreated") {
              const id = (parsed.args?.projectId ?? parsed.args?.[0]) as bigint | undefined;
              if (typeof id !== "undefined") {
                newId = Number(id);
                break;
              }
            }
          } catch {}
        }
      } catch {}
      setLastCreatedProjectId(newId);
      setMessage(newId !== undefined ? `Project created successfully! ID: ${newId}, Transaction: ${tx.hash}` : `Project created! Transaction: ${tx.hash}`);
    } catch {
      setMessage("Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [donation.address, donation.abi, ethersSigner, isSubmitting]);

  useEffect(() => { setMessage(""); }, [donation.address, chainId, ethersSigner?.address]);

  useEffect(() => {
    setMyDonationHandle(undefined);
    setMyDonationClear(undefined);
    myDonationRef.current = undefined;
  }, [ethersSigner?.address, donation.address, chainId]);

  useEffect(() => {
    setDeployerAddress(undefined);
    if (!donation.address || !ethersReadonlyProvider || !donation.chainId) return;
    const info = DonationDeployInfo[String(donation.chainId)];
    if (!info) return;
    (ethersReadonlyProvider as ethers.JsonRpcProvider).getTransactionReceipt(info.transactionHash)
      .then((rcpt) => {
        const contractAddress = (rcpt as any).contractAddress as string | undefined;
        const from = (rcpt as any).from as string | undefined;
        if (contractAddress && from && contractAddress.toLowerCase() === donation.address?.toLowerCase()) {
          setDeployerAddress(from);
        }
      })
      .catch(() => {})
      .finally(() => {});
  }, [donation.address, donation.chainId, ethersReadonlyProvider]);

  return {
    contractAddress: donation.address,
    isDeployed,
    message,
    canGetProjectTotal,
    canGetMyDonation,
    canDecryptProjectTotal,
    canDecryptMyDonation,
    refreshProjectTotal,
    refreshMyDonation,
    decryptProjectTotal,
    decryptMyDonation,
    donate,
    createProject,
    projectTotalHandle,
    projectTotalClear,
    myDonationHandle,
    myDonationClear,
    deployerAddress,
    projectOwner,
    projectName,
    lastCreatedProjectId,
  };
};


