"use client";
import React from "react";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Donation FHEVM - Secure Encrypted Donations</title>
        <meta name="description" content="Make secure, encrypted donations using FHEVM technology" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <MetaMaskProvider>
          <MetaMaskEthersSignerProvider initialMockChains={{ 31337: "http://localhost:8545" }}>
            {children}
          </MetaMaskEthersSignerProvider>
        </MetaMaskProvider>
      </body>
    </html>
  );
}


