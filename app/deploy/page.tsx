"use client";

import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseAbi,
  parseEther,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import artifact from "../../contracts/artifacts/contracts/FairTicket.sol/FairTicket.json";
import { monadTestnet } from "../../lib/fair-ticket";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const ORGANIZER = "0x6DFddE363d0119124919c796864478774323f991" as Address;
const FINAL_CONTRACT = "0xa076acc389960c75970da41a7b74efa13be05ac4" as Address;
const ownershipAbi = parseAbi([
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
]);

async function findMetaMask() {
  return new Promise<EIP1193Provider | undefined>((resolve) => {
    let fallback = window.ethereum;
    let settled = false;
    const finish = (provider?: EIP1193Provider) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("eip6963:announceProvider", announce);
      resolve(provider);
    };
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { name?: string; rdns?: string }; provider?: EIP1193Provider }>).detail;
      if (!detail?.provider) return;
      fallback ??= detail.provider;
      if (/metamask/i.test(`${detail.info?.name ?? ""} ${detail.info?.rdns ?? ""}`)) finish(detail.provider);
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => finish(fallback), 700);
  });
}

export default function DeployPage() {
  const [status, setStatus] = useState("Ready to create the final 10-ticket contract.");
  const [contractAddress, setContractAddress] = useState<Address>();
  const [busy, setBusy] = useState(false);

  async function finalizeOrganizer() {
    if (busy) return;
    setBusy(true);
    try {
      const provider = await findMetaMask();
      if (!provider) throw new Error("Open this page in Brave with MetaMask enabled.");
      const wallet = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
      try {
        await wallet.switchChain({ id: monadTestnet.id });
      } catch {
        await wallet.addChain({ chain: monadTestnet });
        await wallet.switchChain({ id: monadTestnet.id });
      }
      const [account] = await wallet.requestAddresses();
      const publicClient = createPublicClient({ chain: monadTestnet, transport: custom(provider), pollingInterval: 2_000 });
      const currentOwner = await publicClient.readContract({
        address: FINAL_CONTRACT,
        abi: ownershipAbi,
        functionName: "owner",
      });
      if (currentOwner.toLowerCase() === ORGANIZER.toLowerCase()) {
        setContractAddress(FINAL_CONTRACT);
        setStatus("Already complete. Account 1 is the organizer; Account 2 can buy and resell up to 10 tickets.");
        return;
      }
      setStatus("Confirm the organizer change in MetaMask.");
      const hash = await wallet.writeContract({
        account,
        address: FINAL_CONTRACT,
        abi: ownershipAbi,
        functionName: "transferOwnership",
        args: [ORGANIZER],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("The organizer change was not confirmed.");
      setContractAddress(FINAL_CONTRACT);
      setStatus("Done. Account 1 is the organizer; Account 2 can buy and resell up to 10 tickets.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Organizer setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    if (busy) return;
    setBusy(true);
    try {
      const provider = await findMetaMask();
      if (!provider) throw new Error("Open this page in Brave with MetaMask enabled.");
      const wallet = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
      try {
        await wallet.switchChain({ id: monadTestnet.id });
      } catch {
        await wallet.addChain({ chain: monadTestnet });
        await wallet.switchChain({ id: monadTestnet.id });
      }
      const [account] = await wallet.requestAddresses();
      setStatus("Confirm the contract deployment in MetaMask.");
      const hash = await wallet.deployContract({
        account,
        chain: monadTestnet,
        abi: artifact.abi as Abi,
        bytecode: artifact.bytecode as Hex,
        args: [
          ORGANIZER,
          "Neon Ragas",
          "HITEX Arena, Hyderabad",
          1_788_012_000n,
          20,
          10,
          parseEther("0.01"),
          1_000,
          "https://fairticket-monad.sujeethsai265.chatgpt.site/api/metadata/",
        ],
      });
      setStatus("Deployment submitted. Waiting for Monad Testnet confirmation…");
      const publicClient = createPublicClient({ chain: monadTestnet, transport: custom(provider), pollingInterval: 2_000 });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Contract deployment was not confirmed.");
      setContractAddress(receipt.contractAddress);
      setStatus("Final 10-ticket FairTicket contract is live.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Deployment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f1e9" }}>
      <section style={{ width: "min(680px, 100%)", padding: "48px", border: "1px solid #111", borderRadius: 28, background: "white", boxShadow: "12px 12px 0 #111" }}>
        <p className="ft-panel-label">FINAL TESTNET SETUP</p>
        <h1 style={{ fontSize: "clamp(46px, 8vw, 76px)", letterSpacing: "-0.07em", lineHeight: 0.9, margin: "22px 0" }}>Deploy the<br /><em style={{ color: "#4646e8" }}>10-ticket</em> contract.</h1>
        <p style={{ color: "#4b4c46", lineHeight: 1.7 }}>This creates the corrected Monad Testnet contract. Account 2 remains a buyer and ticket holder; Account 1 is the organizer.</p>
        <div style={{ display: "grid", gap: 10, margin: "26px 0", padding: 20, background: "#f4f1e9", borderRadius: 18 }}>
          <span>Wallet maximum — <b>10 tickets</b></span>
          <span>Resale maximum — <b>110%</b></span>
          <span>Event supply — <b>20 tickets</b></span>
        </div>
        <button type="button" onClick={finalizeOrganizer} disabled={busy} style={{ width: "100%", border: 0, borderRadius: 999, padding: "16px 20px", background: "#111", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{busy ? "Waiting for MetaMask…" : "Finish organizer setup"}</button>
        <button type="button" onClick={deploy} disabled={busy} style={{ width: "100%", marginTop: 10, border: "1px solid #111", borderRadius: 999, padding: "14px 20px", background: "transparent", color: "#111", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Deploy a fresh contract instead</button>
        <p style={{ marginTop: 18, fontWeight: 700 }}>{status}</p>
        {contractAddress ? <a href={`/?contract=${contractAddress}`} style={{ display: "inline-block", marginTop: 14, color: "#4646e8", fontWeight: 800 }}>Open FairTicket with the new contract →</a> : null}
      </section>
    </main>
  );
}
