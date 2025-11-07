"use client";
import React, { useMemo, useState } from "react";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import { useDonation } from "@/hooks/useDonation";

export default function HomePage() {
  const {
    provider,
    chainId,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = useMetaMaskEthersSigner();

  const { instance, status, error } = useFhevm({
    provider,
    chainId,
    initialMockChains: { 31337: "http://localhost:8545" },
    enabled: true,
  });

  const donation = useDonation({
    instance,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const [projectName, setProjectName] = useState("");
  const [donateProjectId, setDonateProjectId] = useState<number>(1);
  const [donateAmount, setDonateAmount] = useState<string>("");

  const ready = useMemo(() => isConnected && status === "ready" && donation.isDeployed, [isConnected, status, donation.isDeployed]);

  return (
    <div className="container">
      <div className="header">
        <h1>Secure Encrypted Donations</h1>
        <p className="subtitle">
          Make private donations using Fully Homomorphic Encryption (FHEVM)
        </p>
        {!isConnected && (
          <button onClick={connect} disabled={isConnected} className="btn btn-connect">
            Connect MetaMask Wallet
          </button>
        )}
      </div>

      {/* Connection Status */}
      <section className="card">
        <h2>Connection Status</h2>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">FHEVM Status</div>
            <div className="status-value">
              <span className={`badge ${status === "ready" ? "badge-success" : status === "error" ? "badge-error" : "badge-warning"}`}>
                {status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Wallet Address</div>
            <div className="status-value" title={ethersSigner?.address ?? "Not connected"}>
              {ethersSigner?.address ? `${ethersSigner.address.slice(0, 6)}...${ethersSigner.address.slice(-4)}` : "Not connected"}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Contract Status</div>
            <div className="status-value">
              <span className={`badge ${donation.isDeployed ? "badge-success" : "badge-warning"}`}>
                {donation.isDeployed ? "DEPLOYED" : "NOT DEPLOYED"}
              </span>
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Contract Address</div>
            <div className="status-value" title={donation.contractAddress ?? "N/A"}>
              {donation.contractAddress ? `${donation.contractAddress.slice(0, 6)}...${donation.contractAddress.slice(-4)}` : "N/A"}
            </div>
          </div>
        </div>
        {error && (
          <div className="error-message">
            FHEVM Error: {error.message}
          </div>
        )}
        {donation.message && (
          <div className="info-box">
            <strong>Status:</strong> {donation.message}
          </div>
        )}
      </section>

      {/* Create Project */}
      <section className="card">
        <h2>Create New Project</h2>
        <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
          Start a new fundraising project. You'll be able to receive encrypted donations. Project owners can decrypt the total amount.
        </p>
        <div className="input-group">
          <input
            placeholder="Enter project name (e.g., Community Garden Fund)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="input"
          />
          <button 
            disabled={!ready || !projectName} 
            onClick={() => donation.createProject(projectName)}
            className="btn btn-primary"
          >
            Create Project
          </button>
        </div>
        {donation.lastCreatedProjectId !== undefined && (
          <div className="success-message">
            Project created successfully! Your project ID is: <strong>{donation.lastCreatedProjectId}</strong>
          </div>
        )}
        {!ready && isConnected && (
          <div className="warning-message">
            Please wait for the system to initialize before creating a project.
          </div>
        )}
      </section>

      {/* Donate */}
      <section className="card">
        <h2>Make a Donation</h2>
        <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
          Support a project with an encrypted donation. The amount will remain private.
        </p>
        <div className="input-group">
          <input
            type="number"
            placeholder="Project ID"
            value={donateProjectId}
            onChange={(e) => setDonateProjectId(Number(e.target.value || 0))}
            className="input input-small"
          />
          <input
            type="number"
            placeholder="Donation amount"
            value={donateAmount}
            onChange={(e) => setDonateAmount(e.target.value)}
            className="input"
          />
          <button
            disabled={!ready || !donateAmount || Number(donateAmount) <= 0}
            onClick={() => donation.donate(donateProjectId, Number(donateAmount))}
            className="btn btn-primary"
          >
            Donate (Encrypted)
          </button>
        </div>
        {!ready && isConnected && (
          <div className="warning-message">
            Please wait for the system to initialize before making a donation.
          </div>
        )}
      </section>

      {/* Project Total */}
      <section className="card">
        <h2>View Project Total</h2>
        <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
          Check the total amount donated to a project. Only the project owner can decrypt the total.
        </p>
        <div className="input-group">
          <input
            type="number"
            placeholder="Project ID"
            value={donateProjectId}
            onChange={(e) => setDonateProjectId(Number(e.target.value || 0))}
            className="input input-small"
          />
          <button 
            disabled={!donation.canGetProjectTotal} 
            onClick={() => donation.refreshProjectTotal(donateProjectId)}
            className="btn btn-secondary"
          >
            Fetch Encrypted Total
          </button>
          <button 
            disabled={!donation.canDecryptProjectTotal} 
            onClick={() => donation.decryptProjectTotal()}
            className="btn btn-primary"
          >
            Decrypt Total
          </button>
        </div>
        <div className="result-section">
          <div className="result-item">
            <span className="result-label">Project Owner:</span>
            <span className="result-value" title={donation.projectOwner ?? "Unknown"}>
              {donation.projectOwner ? `${donation.projectOwner.slice(0, 6)}...${donation.projectOwner.slice(-4)}` : "Unknown"}
            </span>
          </div>
          {ethersSigner?.address && donation.projectOwner && donation.projectOwner.toLowerCase() !== ethersSigner.address.toLowerCase() && (
            <div className="warning-message">
              Only the project owner can decrypt the total amount. You are viewing as a guest.
            </div>
          )}
          <div className="result-item">
            <span className="result-label">Encrypted Handle:</span>
            <span className="result-value">{donation.projectTotalHandle ?? "Not fetched yet"}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Decrypted Total:</span>
            <span className="result-value">
              {donation.projectTotalClear !== undefined ? (
                <strong style={{ color: "var(--primary-green)", fontSize: "1.125rem" }}>
                  {donation.projectTotalClear}
                </strong>
              ) : (
                "Not decrypted yet"
              )}
            </span>
          </div>
        </div>
      </section>

      {/* My Donation */}
      <section className="card">
        <h2>My Personal Donation</h2>
        <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
          View your encrypted donation amount to a specific project. Only you can decrypt it.
        </p>
        <div className="input-group">
          <input
            type="number"
            placeholder="Project ID"
            value={donateProjectId}
            onChange={(e) => setDonateProjectId(Number(e.target.value || 0))}
            className="input input-small"
          />
          <button 
            disabled={!donation.canGetMyDonation} 
            onClick={() => donation.refreshMyDonation(donateProjectId)}
            className="btn btn-secondary"
          >
            Fetch My Encrypted Donation
          </button>
          <button 
            disabled={!donation.canDecryptMyDonation} 
            onClick={() => donation.decryptMyDonation()}
            className="btn btn-primary"
          >
            Decrypt My Donation
          </button>
        </div>
        <div className="result-section">
          <div className="result-item">
            <span className="result-label">Encrypted Handle:</span>
            <span className="result-value">{donation.myDonationHandle ?? "Not fetched yet"}</span>
          </div>
          <div className="result-item">
            <span className="result-label">My Donation Amount:</span>
            <span className="result-value">
              {donation.myDonationClear !== undefined ? (
                <strong style={{ color: "var(--primary-orange)", fontSize: "1.125rem" }}>
                  {donation.myDonationClear}
                </strong>
              ) : (
                "Not decrypted yet"
              )}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}


