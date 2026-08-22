"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import {
  fairTicketAbi,
  fairTicketAddress,
  monadPublicClient,
  monadTestnet,
} from "../lib/fair-ticket";

type View = "event" | "market" | "tickets" | "gate";
type TicketStatus = "ready" | "listed" | "used";
type NoticeStatus = "info" | "warning" | "error" | "success";

type TicketItem = {
  id: number;
  status: TicketStatus;
  listingPrice?: bigint;
  purchasePrice: bigint;
  maxResalePrice: bigint;
};

type MarketItem = {
  id: number;
  priceWei: bigint;
  seller: string;
  maxPriceWei: bigint;
};

type EventSnapshot = {
  name: string;
  venue: string;
  startsAt: bigint;
  maxSupply: number;
  maxPerWallet: number;
  faceValue: bigint;
  resaleCap: bigint;
  resaleMarkupBps: number;
  totalMinted: number;
};

type Notice = {
  status: NoticeStatus;
  title: string;
  description: string;
};

const DEMO_ACCOUNT = "0x7a4fD4A109fa9bBDE0B19A5aC6d42BAb7C2A29C1" as Address;
const DEMO_FACE_PRICE = parseEther("0.01");
const DEMO_RESALE_LIMIT = parseEther("0.011");

const demoEvent: EventSnapshot = {
  name: "Neon Ragas",
  venue: "HITEX Arena, Hyderabad",
  startsAt: 1_788_012_000n,
  maxSupply: 20,
  maxPerWallet: 10,
  faceValue: DEMO_FACE_PRICE,
  resaleCap: DEMO_RESALE_LIMIT,
  resaleMarkupBps: 1_000,
  totalMinted: 6,
};

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

let activeWalletProvider: EIP1193Provider | undefined;

async function findWalletProvider() {
  if (activeWalletProvider) return activeWalletProvider;

  return new Promise<EIP1193Provider | undefined>((resolve) => {
    let fallbackProvider = window.ethereum;
    let finished = false;

    const finish = (provider?: EIP1193Provider) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("eip6963:announceProvider", onProvider);
      activeWalletProvider = provider;
      resolve(provider);
    };

    const onProvider = (event: Event) => {
      const detail = (event as CustomEvent<{
        info?: { name?: string; rdns?: string };
        provider?: EIP1193Provider;
      }>).detail;
      if (!detail?.provider) return;
      fallbackProvider ??= detail.provider;
      if (/metamask/i.test(`${detail.info?.name ?? ""} ${detail.info?.rdns ?? ""}`)) {
        finish(detail.provider);
      }
    };

    window.addEventListener("eip6963:announceProvider", onProvider);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => finish(fallbackProvider), 700);
  });
}

const initialMarket: MarketItem[] = [
  { id: 4, priceWei: parseEther("0.0108"), maxPriceWei: DEMO_RESALE_LIMIT, seller: "0x28d7…e901" },
  { id: 9, priceWei: DEMO_RESALE_LIMIT, maxPriceWei: DEMO_RESALE_LIMIT, seller: "0x91b2…8ac4" },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMon(value: bigint) {
  const [whole, fraction = ""] = formatEther(value).split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${trimmedFraction ? `${whole}.${trimmedFraction}` : whole} MON`;
}

function eventDateLabel(startsAt: bigint) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(Number(startsAt) * 1_000));
}

function errorMessage(error: unknown) {
  const message = error instanceof BaseError
    ? error.shortMessage
    : error instanceof Error
      ? error.message
      : "";
  if (/user rejected|denied|cancelled/i.test(message)) return "The wallet request was cancelled. Nothing was charged.";
  if (/http request failed|rate|limit|busy|timeout|network/i.test(message)) {
    return "Monad Testnet is temporarily busy. Your confirmed transaction is safe; wait a few seconds and refresh.";
  }
  if (/PurchaseLimitExceeded/i.test(message)) return "This wallet has already reached the 10-ticket lifetime purchase limit.";
  if (/OrganizerCannotResell/i.test(message)) return "The organizer cannot resell tickets. Only attendee wallets can list tickets.";
  if (/InvalidResalePrice/i.test(message)) return "That resale price is above this ticket's 110% limit.";
  if (message) return message;
  return "The transaction could not be completed.";
}

function createGateDeadline() {
  return BigInt(Math.floor(Date.now() / 1_000) + 600);
}

export default function Home() {
  const [view, setView] = useState<View>("event");
  const [account, setAccount] = useState<Address>();
  const [isDemoWallet, setIsDemoWallet] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [market, setMarket] = useState<MarketItem[]>(fairTicketAddress ? [] : initialMarket);
  const [event, setEvent] = useState<EventSnapshot>(demoEvent);
  const [organizer, setOrganizer] = useState<Address>();
  const [sellerBalance, setSellerBalance] = useState(0n);
  const [organizerBalance, setOrganizerBalance] = useState(0n);
  const [lifetimePurchaseCount, setLifetimePurchaseCount] = useState(0n);
  const [listPrices, setListPrices] = useState<Record<number, number>>({});
  const [gateProof, setGateProof] = useState("");
  const [pendingAction, setPendingAction] = useState<string>();
  const [notice, setNotice] = useState<Notice>({
    status: "info",
    title: fairTicketAddress ? "Live Monad contract is ready" : "Guided demo is active",
    description: fairTicketAddress
      ? "Connect MetaMask to buy, resell, claim proceeds, or prove a ticket on Monad Testnet."
      : "Every flow works without gas. Deployment activates the same interface on Monad Testnet.",
  });

  const hasLiveContract = Boolean(fairTicketAddress);
  const isLive = Boolean(hasLiveContract && account && !isDemoWallet);
  const isOrganizer = Boolean(account && organizer && account.toLowerCase() === organizer.toLowerCase());
  const modeLabel = fairTicketAddress ? "Monad testnet" : "Guided demo";
  const remaining = Math.max(0, event.maxSupply - event.totalMinted);
  const walletAllowance = Math.max(0, event.maxPerWallet - Number(lifetimePurchaseCount));
  const isBusy = Boolean(pendingAction);

  async function connectWallet() {
    try {
      const provider = await findWalletProvider();
      if (!provider) {
        setAccount(DEMO_ACCOUNT);
        setIsDemoWallet(true);
        setNotice({
          status: "success",
          title: "Demo wallet connected",
          description: "Buying, resale, ticket proof, and gate check-in now work instantly without a wallet transaction.",
        });
        return;
      }

      const wallet = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
      try {
        await wallet.switchChain({ id: monadTestnet.id });
      } catch {
        await wallet.addChain({ chain: monadTestnet });
        await wallet.switchChain({ id: monadTestnet.id });
      }
      const [selectedAccount] = await wallet.requestAddresses();
      setAccount(selectedAccount);
      setIsDemoWallet(false);

      if (fairTicketAddress) {
        await refreshLiveData(selectedAccount);
        setNotice({
          status: "success",
          title: "Wallet connected to Monad Testnet",
          description: "Purchases and marketplace actions will now request real wallet signatures.",
        });
      } else {
        setNotice({
          status: "success",
          title: "Wallet connected in demo mode",
          description: "The UI is ready; deployment will activate real contract transactions.",
        });
      }
    } catch (error) {
      setNotice({ status: "error", title: "Wallet connection failed", description: errorMessage(error) });
    }
  }

  function disconnectWallet() {
    setAccount(undefined);
    setIsDemoWallet(false);
    setTickets([]);
    setLifetimePurchaseCount(0n);
    setNotice({
      status: "info",
      title: "Wallet disconnected",
      description: "Connect again when you want to transact or show a ticket proof.",
    });
  }

  async function getWallet() {
    const provider = await findWalletProvider();
    if (!provider) throw new Error("A browser wallet is required for a live transaction.");
    const wallet = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
    try {
      await wallet.switchChain({ id: monadTestnet.id });
    } catch {
      await wallet.addChain({ chain: monadTestnet });
      await wallet.switchChain({ id: monadTestnet.id });
    }
    return wallet;
  }

  async function waitForWalletReceipt(hash: Hex) {
    const provider = await findWalletProvider();
    if (!provider) throw new Error("A browser wallet is required to confirm the transaction.");
    const walletPublicClient = createPublicClient({
      chain: monadTestnet,
      transport: custom(provider),
      pollingInterval: 2_000,
    });
    const receipt = await walletPublicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
    if (receipt.status !== "success") {
      throw new Error("Transaction failed on Monad Testnet. Nothing was completed or charged.");
    }
    return receipt;
  }

  const refreshLiveData = useCallback(async (holder?: Address) => {
    const address = fairTicketAddress;
    if (!address) return;

    const [
      name,
      venue,
      startsAt,
      maxSupply,
      maxPerWallet,
      faceValue,
      resaleCap,
      resaleMarkupBps,
      totalMinted,
      contractOwner,
      organizerProceeds,
      active,
    ] = await monadPublicClient.multicall({
      allowFailure: false,
      contracts: [
        { address, abi: fairTicketAbi, functionName: "eventName" },
        { address, abi: fairTicketAbi, functionName: "venue" },
        { address, abi: fairTicketAbi, functionName: "eventStartsAt" },
        { address, abi: fairTicketAbi, functionName: "maxSupply" },
        { address, abi: fairTicketAbi, functionName: "maxPerWallet" },
        { address, abi: fairTicketAbi, functionName: "faceValue" },
        { address, abi: fairTicketAbi, functionName: "resaleCap" },
        { address, abi: fairTicketAbi, functionName: "resaleMarkupBps" },
        { address, abi: fairTicketAbi, functionName: "totalMinted" },
        { address, abi: fairTicketAbi, functionName: "owner" },
        { address, abi: fairTicketAbi, functionName: "organizerProceeds" },
        { address, abi: fairTicketAbi, functionName: "activeListings" },
      ],
    });

    setEvent({
      name,
      venue,
      startsAt,
      maxSupply: Number(maxSupply),
      maxPerWallet: Number(maxPerWallet),
      faceValue,
      resaleCap,
      resaleMarkupBps: Number(resaleMarkupBps),
      totalMinted: Number(totalMinted),
    });
    setOrganizer(contractOwner);
    setOrganizerBalance(organizerProceeds);
    setMarket(
      active[0].map((tokenId, index) => ({
        id: Number(tokenId),
        seller: active[1][index],
        priceWei: active[2][index],
        maxPriceWei: resaleCap,
      })),
    );

    if (!holder) {
      setTickets([]);
      setSellerBalance(0n);
      setLifetimePurchaseCount(0n);
      return;
    }

    const [tokenIds, proceeds, purchases] = await monadPublicClient.multicall({
      allowFailure: false,
      contracts: [
        { address, abi: fairTicketAbi, functionName: "ticketsOf", args: [holder] },
        { address, abi: fairTicketAbi, functionName: "sellerProceeds", args: [holder] },
        { address, abi: fairTicketAbi, functionName: "primaryPurchases", args: [holder] },
      ],
    });

    setSellerBalance(proceeds);
    setLifetimePurchaseCount(purchases);

    const ticketState = tokenIds.length
      ? await monadPublicClient.multicall({
          allowFailure: false,
          contracts: tokenIds.flatMap((tokenId) => [
            { address, abi: fairTicketAbi, functionName: "used" as const, args: [tokenId] },
            { address, abi: fairTicketAbi, functionName: "listings" as const, args: [tokenId] },
          ]),
        })
      : [];

    const liveTickets = tokenIds.map((tokenId, index) => {
        const checkedIn = ticketState[index * 2] as boolean;
        const listing = ticketState[index * 2 + 1] as readonly [Address, bigint];
        const listingPrice = listing[1];
        const status: TicketStatus = checkedIn
          ? "used"
          : listingPrice > 0n
            ? "listed"
            : "ready";
        return {
          id: Number(tokenId),
          status,
          listingPrice: listingPrice || undefined,
          purchasePrice: faceValue,
          maxResalePrice: resaleCap,
        };
      });

    setTickets(liveTickets);
  }, []);

  useEffect(() => {
    if (!fairTicketAddress) return;
    const holder = account && !isDemoWallet ? account : undefined;
    void refreshLiveData(holder).catch((error) => {
      setNotice({
        status: "error",
        title: "Could not read the live contract",
        description: errorMessage(error),
      });
    });

    const interval = window.setInterval(() => {
      void refreshLiveData(holder).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [account, isDemoWallet, refreshLiveData]);

  useEffect(() => {
    const provider = (activeWalletProvider ?? window.ethereum) as
      | (EIP1193Provider & {
          on?: (event: string, listener: (...args: unknown[]) => void) => void;
          removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
        })
      | undefined;
    if (!provider?.on) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as Address[] | undefined;
      const nextAccount = accounts?.[0];
      setAccount(nextAccount);
      setIsDemoWallet(false);
      if (!nextAccount) setTickets([]);
    };
    const handleChainChanged = () => {
      const holder = account && !isDemoWallet ? account : undefined;
      void refreshLiveData(holder).catch(() => undefined);
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [account, isDemoWallet, refreshLiveData]);

  async function buyPrimary() {
    if (isBusy) return;
    if (!account) return connectWallet();
    if (!isLive) {
      if (Number(lifetimePurchaseCount) + quantity > event.maxPerWallet) {
        setNotice({
          status: "error",
          title: "Wallet limit reached",
          description: `One wallet can buy no more than ${event.maxPerWallet} tickets in total.`,
        });
        return;
      }
      const start = 12 + tickets.length;
      setTickets((current) => [
        ...current,
        ...Array.from({ length: quantity }, (_, index) => ({
          id: start + index,
          status: "ready" as const,
          purchasePrice: event.faceValue,
          maxResalePrice: event.resaleCap,
        })),
      ]);
      setLifetimePurchaseCount((current) => current + BigInt(quantity));
      setView("tickets");
      setNotice({
        status: "success",
        title: `${quantity} ticket${quantity > 1 ? "s" : ""} added to your wallet`,
        description: "The purchase price and 110% resale limit were recorded for each ticket.",
      });
      return;
    }

    setPendingAction("Buying tickets");
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({
        account,
        chain: monadTestnet,
        address: fairTicketAddress!,
        abi: fairTicketAbi,
        functionName: "buyPrimary",
        args: [BigInt(quantity)],
        value: event.faceValue * BigInt(quantity),
      });
      setNotice({ status: "info", title: "Purchase submitted", description: "Waiting for Monad Testnet to confirm the wallet transaction." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setView("tickets");
      setNotice({ status: "success", title: "Ticket purchase confirmed", description: `Transaction ${shortAddress(hash)} is final on Monad Testnet.` });
    } catch (error) {
      setNotice({ status: "error", title: "Purchase failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function listTicket(ticketId: number) {
    if (isBusy) return;
    if (!account) return connectWallet();
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    if (isOrganizer) {
      setNotice({ status: "warning", title: "Organizer resale is disabled", description: "Only attendee wallets that bought tickets can list them for resale." });
      return;
    }
    const price = listPrices[ticketId] ?? Number(formatEther(ticket.purchasePrice));
    const priceWei = parseEther(String(price));
    if (priceWei <= 0n || priceWei > ticket.maxResalePrice) {
      setNotice({ status: "error", title: "Price above the ticket limit", description: `Choose a resale price no higher than ${formatMon(ticket.maxResalePrice)}.` });
      return;
    }

    if (!isLive) {
      setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, status: "listed", listingPrice: priceWei } : ticket));
      setMarket((current) => [...current, { id: ticketId, priceWei, maxPriceWei: ticket.maxResalePrice, seller: account }]);
      setNotice({ status: "success", title: `Ticket #${ticketId} listed`, description: `${formatMon(priceWei)} is within 110% of its purchase price.` });
      return;
    }

    setPendingAction(`Listing ticket #${ticketId}`);
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({
        account,
        chain: monadTestnet,
        address: fairTicketAddress!,
        abi: fairTicketAbi,
        functionName: "listForResale",
        args: [BigInt(ticketId), priceWei],
      });
      setNotice({ status: "info", title: "Listing submitted", description: "Waiting for Monad Testnet confirmation." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setNotice({ status: "success", title: `Ticket #${ticketId} listed`, description: "The protected marketplace listing is now on-chain." });
    } catch (error) {
      setNotice({ status: "error", title: "Listing failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function cancelListing(ticketId: number) {
    if (isBusy) return;
    if (!account) return;
    if (!isLive) {
      setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, status: "ready", listingPrice: undefined } : ticket));
      setMarket((current) => current.filter((item) => item.id !== ticketId));
      setNotice({ status: "info", title: `Ticket #${ticketId} removed from resale`, description: "You still own the unused ticket." });
      return;
    }

    setPendingAction(`Cancelling ticket #${ticketId}`);
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({ account, chain: monadTestnet, address: fairTicketAddress!, abi: fairTicketAbi, functionName: "cancelResale", args: [BigInt(ticketId)] });
      setNotice({ status: "info", title: "Cancellation submitted", description: "Waiting for Monad Testnet confirmation." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setNotice({ status: "success", title: "Listing cancelled", description: `Ticket #${ticketId} is back in your wallet only.` });
    } catch (error) {
      setNotice({ status: "error", title: "Cancellation failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function buyResale(item: MarketItem) {
    if (isBusy) return;
    if (!account) return connectWallet();
    if (tickets.some((ticket) => ticket.id === item.id)) {
      setNotice({ status: "warning", title: "You already own this ticket", description: "A seller cannot purchase their own listing." });
      return;
    }

    if (!isLive) {
      if (lifetimePurchaseCount >= BigInt(event.maxPerWallet)) {
        setNotice({ status: "error", title: "Wallet limit reached", description: `This wallet has already bought ${event.maxPerWallet} tickets in total.` });
        return;
      }
      setMarket((current) => current.filter((listing) => listing.id !== item.id));
      setTickets((current) => [...current, { id: item.id, status: "ready", purchasePrice: item.priceWei, maxResalePrice: item.maxPriceWei }]);
      setLifetimePurchaseCount((current) => current + 1n);
      setView("tickets");
      setNotice({ status: "success", title: `Resale ticket #${item.id} purchased`, description: `${formatMon(item.priceWei)} was paid through the capped marketplace.` });
      return;
    }

    setPendingAction(`Buying resale ticket #${item.id}`);
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({ account, chain: monadTestnet, address: fairTicketAddress!, abi: fairTicketAbi, functionName: "buyResale", args: [BigInt(item.id)], value: item.priceWei });
      setNotice({ status: "info", title: "Resale purchase submitted", description: "Waiting for Monad Testnet confirmation." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setView("tickets");
      setNotice({ status: "success", title: "Protected resale complete", description: `Ticket #${item.id} now belongs to ${shortAddress(account)}.` });
    } catch (error) {
      setNotice({ status: "error", title: "Resale purchase failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function withdrawSellerProceeds() {
    if (isBusy || !account || !isLive || sellerBalance === 0n) return;
    setPendingAction("Claiming resale proceeds");
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({
        account,
        chain: monadTestnet,
        address: fairTicketAddress!,
        abi: fairTicketAbi,
        functionName: "withdrawSellerProceeds",
      });
      setNotice({ status: "info", title: "Claim submitted", description: "Waiting for Monad Testnet confirmation." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setNotice({ status: "success", title: "Resale proceeds claimed", description: `${formatMon(sellerBalance)} was sent to ${shortAddress(account)}.` });
    } catch (error) {
      setNotice({ status: "error", title: "Claim failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function withdrawOrganizerProceeds() {
    if (isBusy || !account || !isLive || !isOrganizer || organizerBalance === 0n) return;
    setPendingAction("Withdrawing organizer proceeds");
    try {
      const wallet = await getWallet();
      const hash = await wallet.writeContract({
        account,
        chain: monadTestnet,
        address: fairTicketAddress!,
        abi: fairTicketAbi,
        functionName: "withdrawOrganizerProceeds",
      });
      setNotice({ status: "info", title: "Withdrawal submitted", description: "Waiting for Monad Testnet confirmation." });
      await waitForWalletReceipt(hash);
      await refreshLiveData(account).catch(() => undefined);
      setNotice({ status: "success", title: "Organizer proceeds withdrawn", description: `${formatMon(organizerBalance)} was sent to the organizer wallet.` });
    } catch (error) {
      setNotice({ status: "error", title: "Withdrawal failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  async function signGateProof(ticketId: number) {
    if (!account) return connectWallet();
    const deadline = createGateDeadline();

    try {
      let signature: Hex = `0x${"1".repeat(130)}`;
      if (isLive) {
        const challenge = await monadPublicClient.readContract({ address: fairTicketAddress!, abi: fairTicketAbi, functionName: "checkInChallenge", args: [BigInt(ticketId), deadline] });
        const wallet = await getWallet();
        signature = await wallet.signMessage({ account, message: { raw: challenge } });
      }
      const proof = JSON.stringify({ tokenId: ticketId, deadline: deadline.toString(), signature }, null, 2);
      setGateProof(proof);
      setNotice({ status: "success", title: `Entry proof signed for ticket #${ticketId}`, description: "The proof expires in ten minutes and cannot be reused after check-in." });
    } catch (error) {
      setNotice({ status: "error", title: "Could not sign entry proof", description: errorMessage(error) });
    }
  }

  async function copyProof() {
    if (!gateProof) return;
    await navigator.clipboard.writeText(gateProof);
    setNotice({ status: "success", title: "Gate proof copied", description: "Send it to the authorized gate operator for validation." });
  }

  async function verifyAtGate() {
    if (isBusy) return;
    if (!gateProof.trim()) {
      setNotice({ status: "error", title: "Gate proof required", description: "Paste the attendee's signed JSON proof first." });
      return;
    }

    try {
      const parsed = JSON.parse(gateProof) as { tokenId: number; deadline: string; signature: Hex };
      const tokenId = Number(parsed.tokenId);
      const deadline = BigInt(parsed.deadline);
      if (!Number.isInteger(tokenId) || tokenId < 1) throw new Error("The proof has an invalid ticket number.");
      if (!/^0x[0-9a-fA-F]{130}$/.test(parsed.signature)) throw new Error("The proof signature is invalid.");

      if (!isLive) {
        const now = BigInt(Math.floor(Date.now() / 1_000));
        if (deadline < now) throw new Error("This proof has expired.");
        if (deadline > now + 600n) throw new Error("This proof lasts longer than the allowed ten minutes.");
        const exists = tickets.some((ticket) => ticket.id === tokenId && ticket.status !== "used");
        if (!exists) throw new Error("This demo wallet does not own that ticket.");
        setTickets((current) => current.map((ticket) => ticket.id === tokenId ? { ...ticket, status: "used" } : ticket));
        setMarket((current) => current.filter((item) => item.id !== tokenId));
      } else {
        if (!account || !isOrganizer) throw new Error("Connect the organizer wallet before gate validation.");
        setPendingAction(`Checking in ticket #${tokenId}`);
        const wallet = await getWallet();
        const hash = await wallet.writeContract({ account, chain: monadTestnet, address: fairTicketAddress!, abi: fairTicketAbi, functionName: "checkIn", args: [BigInt(tokenId), deadline, parsed.signature] });
        setNotice({ status: "info", title: "Check-in submitted", description: "Waiting for Monad Testnet confirmation." });
        await waitForWalletReceipt(hash);
        await refreshLiveData(account).catch(() => undefined);
      }
      setNotice({ status: "success", title: `Ticket #${tokenId} checked in`, description: isLive ? "Ownership proof matched and the ticket is now permanently marked used." : "Demo validation passed. Live mode verifies the same proof cryptographically on Monad." });
    } catch (error) {
      setNotice({ status: "error", title: "Gate verification failed", description: errorMessage(error) });
    } finally {
      setPendingAction(undefined);
    }
  }

  function renderEvent() {
    return (
      <div className="ft-event-layout">
        <section className="ft-event-visual" aria-label={`${event.name} event ticket`}>
          <div className="ft-event-shade" />
          <div className="ft-event-topline">
            <span>FT / 001</span>
            <span>Live admission</span>
          </div>
          <div className="ft-event-copy">
            <span className="ft-kicker">SATURDAY / HYDERABAD</span>
            <h2>{event.name}</h2>
            <p>{eventDateLabel(event.startsAt)}<br />{event.venue}</p>
            <div className="ft-availability"><span />{remaining} of {event.maxSupply} tickets available</div>
          </div>
          <div className="ft-event-cutout" aria-hidden="true" />
        </section>

        <aside className="ft-purchase-panel">
          <div className="ft-purchase-head">
            <span className="ft-panel-label">OFFICIAL RELEASE</span>
            <span className="ft-stock">{remaining} LEFT</span>
            <div className="ft-price-row">
              <strong>{formatMon(event.faceValue)}</strong>
              <span>per ticket</span>
            </div>
          </div>
          <div className="ft-rule-list">
            <div><span>Wallet allowance</span><strong>{walletAllowance} remaining</strong></div>
            <div><span>Lifetime maximum</span><strong>{event.maxPerWallet} tickets</strong></div>
            <div><span>First resale ceiling</span><strong>{formatMon(event.resaleCap)}</strong></div>
          </div>
          <NumberInput label="Number of tickets" value={quantity} onChange={setQuantity} min={1} max={Math.max(1, Math.min(walletAllowance, remaining))} step={1} isIntegerOnly hasNumberSteppers width="100%" />
          <Button label={pendingAction ?? (account ? `Buy ${quantity} for ${formatMon(event.faceValue * BigInt(quantity))}` : "Connect wallet to buy")} variant="primary" size="lg" width="100%" isDisabled={isBusy || (Boolean(account) && (walletAllowance === 0 || quantity > walletAllowance || quantity > remaining))} clickAction={buyPrimary} />
          <Button label="View ticket holder resales" variant="secondary" size="lg" width="100%" onClick={() => setView("market")} />
          <p className="ft-panel-note">Primary tickets come only from the organizer. Resales come only from verified ticket holders.</p>
        </aside>
      </div>
    );
  }

  function renderMarket() {
    return (
      <VStack gap={5}>
        <HStack gap={4} hAlign="between" vAlign="end" wrap="wrap">
          <VStack gap={1}>
            <Heading level={2}>Ticket holder resale</Heading>
            <Text type="body" color="secondary">Only attendee-owned tickets appear here, each with its own 110% price limit.</Text>
          </VStack>
          <Badge variant="purple" label={`${market.length} fair listings`} />
        </HStack>
        {market.length === 0 ? (
          <Card padding={6} variant="muted">
            <VStack gap={2} hAlign="center">
              <Heading level={3}>No resale tickets right now</Heading>
              <Text type="body" color="secondary">Listings appear here as soon as an owner chooses a valid price.</Text>
            </VStack>
          </Card>
        ) : (
          <Grid columns={{ minWidth: 280, max: 3, repeat: "fit" }} gap={4}>
            {market.map((item) => (
              <Card key={item.id} padding={4}>
                <VStack gap={4}>
                  <HStack gap={3} hAlign="between" vAlign="center">
                    <VStack gap={0.5}>
                      <Text type="supporting">NEON RAGAS</Text>
                      <Heading level={3}>Ticket #{String(item.id).padStart(3, "0")}</Heading>
                    </VStack>
                    <Badge variant={item.priceWei === item.maxPriceWei ? "warning" : "purple"} label={item.priceWei === item.maxPriceWei ? "At limit" : "Below limit"} />
                  </HStack>
                  <Divider />
                  <VStack gap={0.5}>
                    <Text type="display-3" hasTabularNumbers>{formatMon(item.priceWei)}</Text>
                    <Text type="supporting">Seller {item.seller.includes("…") ? item.seller : shortAddress(item.seller)} · Maximum {formatMon(item.maxPriceWei)}</Text>
                  </VStack>
                  <Button label={pendingAction ?? (account ? "Buy ticket holder resale" : "Connect wallet to buy")} variant="primary" width="100%" isDisabled={isBusy || lifetimePurchaseCount >= BigInt(event.maxPerWallet)} clickAction={() => buyResale(item)} />
                </VStack>
              </Card>
            ))}
          </Grid>
        )}
      </VStack>
    );
  }

  function renderTickets() {
    return (
      <VStack gap={5}>
        <HStack gap={4} hAlign="between" vAlign="end" wrap="wrap">
          <VStack gap={1}>
            <Heading level={2}>My ticket wallet</Heading>
            <Text type="body" color="secondary">Ticket holders can resell within their ticket&apos;s 110% limit or sign a ten-minute entry proof.</Text>
          </VStack>
          <Button label="Buy another ticket" variant="secondary" onClick={() => setView("event")} />
        </HStack>
        {!account ? (
          <Card padding={6} variant="muted">
            <VStack gap={3} hAlign="center">
              <Heading level={3}>Connect a wallet to see tickets</Heading>
              <Button label="Connect wallet" variant="primary" clickAction={connectWallet} />
            </VStack>
          </Card>
        ) : tickets.length === 0 ? (
          <Card padding={6} variant="muted">
            <VStack gap={3} hAlign="center">
              <Heading level={3}>No tickets in this wallet</Heading>
              <Text type="body" color="secondary">Buy at face value or choose a protected resale.</Text>
              <Button label="View the event" variant="primary" onClick={() => setView("event")} />
            </VStack>
          </Card>
        ) : (
          <Grid columns={{ minWidth: 300, max: 2, repeat: "fit" }} gap={4}>
            {tickets.map((ticket) => (
              <Card key={ticket.id} padding={5} elevation={ticket.status === "ready" ? "low" : "none"}>
                <VStack gap={4}>
                  <HStack gap={3} hAlign="between" vAlign="center">
                    <VStack gap={0.5}>
                      <Text type="supporting">NEON RAGAS · AUG 29</Text>
                      <Heading level={3}>Ticket #{String(ticket.id).padStart(3, "0")}</Heading>
                    </VStack>
                    {ticket.status === "listed" ? <Badge variant="warning" label="Listed" /> : ticket.status === "used" ? <Badge variant="neutral" label="Used" /> : <StatusDot variant="success" label="Ready for entry" />}
                  </HStack>
                  <Divider />
                  <Grid columns={2} gap={3}>
                    <VStack gap={0.5}>
                      <Text type="supporting">Owner</Text>
                      <Text type="body" weight="semibold">{shortAddress(account)}</Text>
                    </VStack>
                    <VStack gap={0.5}>
                      <Text type="supporting">Price paid / resale limit</Text>
                      <Text type="body" weight="semibold">{formatMon(ticket.purchasePrice)} / {formatMon(ticket.maxResalePrice)}</Text>
                    </VStack>
                  </Grid>
                  {ticket.status === "ready" ? (
                    <VStack gap={3}>
                      <NumberInput label="Resale price" value={listPrices[ticket.id] ?? Number(formatEther(ticket.purchasePrice))} onChange={(value) => setListPrices((current) => ({ ...current, [ticket.id]: value }))} min={0.0001} max={Number(formatEther(ticket.maxResalePrice))} step={0.0001} units="MON" width="100%" />
                      <HStack gap={3} wrap="wrap">
                        <Button label={isOrganizer ? "Organizer cannot resell" : "List ticket"} variant="secondary" isDisabled={isBusy || isOrganizer} clickAction={() => listTicket(ticket.id)} />
                        <Button label="Sign entry proof" variant="primary" isDisabled={isBusy} clickAction={() => signGateProof(ticket.id)} />
                      </HStack>
                    </VStack>
                  ) : ticket.status === "listed" ? (
                    <VStack gap={2}>
                      <Text type="body">Listed for {formatMon(ticket.listingPrice ?? 0n)}</Text>
                      <Button label={pendingAction ?? "Cancel listing"} variant="secondary" isDisabled={isBusy} clickAction={() => cancelListing(ticket.id)} />
                    </VStack>
                  ) : (
                    <Text type="body" color="secondary">This ticket cannot be sold or checked in again.</Text>
                  )}
                </VStack>
              </Card>
            ))}
          </Grid>
        )}
        {account ? (
          <Card padding={4} variant="muted">
            <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
              <VStack gap={1}>
                <Heading level={3}>Wallet settlement</Heading>
                <Text type="body" color="secondary">
                  Lifetime purchases: {lifetimePurchaseCount.toString()} of {event.maxPerWallet} · Claimable resale proceeds: {formatMon(sellerBalance)}
                </Text>
              </VStack>
              <Button
                label="Claim resale proceeds"
                variant="secondary"
                isDisabled={isBusy || !isLive || sellerBalance === 0n}
                clickAction={withdrawSellerProceeds}
              />
            </HStack>
          </Card>
        ) : null}
        {gateProof ? (
          <Card padding={4} variant="muted">
            <VStack gap={3}>
              <Heading level={3}>Latest signed gate proof</Heading>
              <TextArea label="Signed proof JSON" value={gateProof} onChange={setGateProof} rows={7} hasSpellCheck={false} width="100%" />
              <HStack gap={3} wrap="wrap">
                <Button label="Copy proof" variant="primary" clickAction={copyProof} />
                <Button label="Open gate station" variant="secondary" onClick={() => setView("gate")} />
              </HStack>
            </VStack>
          </Card>
        ) : null}
      </VStack>
    );
  }

  function renderGate() {
    return (
      <Grid columns={{ minWidth: 320, max: 2, repeat: "fit" }} gap={5}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Text type="label" color="accent">AUTHORIZED STAFF</Text>
            <Heading level={2}>Gate verification station</Heading>
            <Text type="body" color="secondary">Paste the attendee’s signed proof. The contract checks current ownership, expiry, signature, and unused status.</Text>
          </VStack>
          {hasLiveContract && !isOrganizer ? (
            <Banner
              status="warning"
              title="Organizer wallet required"
              description={organizer ? `Connect ${shortAddress(organizer)} to perform an on-chain check-in.` : "Connect the contract owner wallet to perform an on-chain check-in."}
            />
          ) : null}
          <TextArea label="Attendee proof JSON" value={gateProof} onChange={setGateProof} rows={10} hasSpellCheck={false} width="100%" placeholder={'{\n  "tokenId": 12,\n  "deadline": "...",\n  "signature": "0x..."\n}'} />
          <Button label={pendingAction ?? "Verify owner and check in"} variant="primary" size="lg" width="100%" isDisabled={isBusy || (hasLiveContract && !isOrganizer)} clickAction={verifyAtGate} />
        </VStack>
        <Card padding={5} variant="muted">
          <VStack gap={4}>
            <Heading level={3}>Four checks before entry</Heading>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center"><StatusDot variant="success" label="Owner check" /><Text type="body">Signer is the ticket’s current on-chain owner</Text></HStack>
              <HStack gap={3} vAlign="center"><StatusDot variant="success" label="Expiry check" /><Text type="body">Proof deadline has not passed</Text></HStack>
              <HStack gap={3} vAlign="center"><StatusDot variant="success" label="Replay check" /><Text type="body">Ticket has not already been used</Text></HStack>
              <HStack gap={3} vAlign="center"><StatusDot variant="success" label="Gate authorization check" /><Text type="body">Transaction comes from the organizer wallet</Text></HStack>
            </VStack>
            <Divider />
            <Text type="supporting">In live mode, only the contract owner can submit check-ins. Keep the organizer wallet separate from attendee wallets.</Text>
            <Divider />
            <VStack gap={2}>
              <Text type="supporting">Organizer proceeds</Text>
              <Text type="large" weight="semibold" hasTabularNumbers>{formatMon(organizerBalance)}</Text>
              <Button
                label="Withdraw organizer proceeds"
                variant="secondary"
                isDisabled={isBusy || !isLive || !isOrganizer || organizerBalance === 0n}
                clickAction={withdrawOrganizerProceeds}
              />
            </VStack>
          </VStack>
        </Card>
      </Grid>
    );
  }

  return (
    <Theme theme={neutralTheme} mode="light">
      <div className="ft-app">
        <header className="ft-header">
          <div className="ft-brand">
            <span className="ft-brand-mark">FT</span>
            <span><strong>FairTicket</strong><small>Verified admission</small></span>
          </div>
          <div className="ft-header-center"><span>Hyderabad</span><i /> <span>29 Aug 2026</span></div>
          <div className="ft-header-actions">
            <div className="ft-network"><StatusDot variant={hasLiveContract ? "success" : "accent"} label={hasLiveContract ? "Live" : "Demo"} isPulsing={hasLiveContract} /><span>{modeLabel}</span></div>
            <Button label={account ? shortAddress(account) : "Connect wallet"} variant={account ? "secondary" : "primary"} clickAction={account ? disconnectWallet : connectWallet} />
          </div>
        </header>

        <main className="ft-main">
          <section className="ft-hero">
            <div className="ft-hero-copy">
              <span className="ft-eyebrow"><i />FAIR BY DESIGN</span>
              <h1>A better way<br />to own a <em>seat.</em></h1>
              <p>Buy from the organizer. Resell only within the ticket&apos;s fair-price limit. Enter once with a verified digital pass.</p>
              <button type="button" className="ft-text-link" onClick={() => setView("event")}>Explore the event <span>↗</span></button>
            </div>
            <div className="ft-hero-pass" aria-hidden="true">
              <div className="ft-pass-rail"><span>FAIR / ACCESS / 2026</span><b>FT</b></div>
              <div className="ft-pass-body">
                <div className="ft-pass-code">NR—029</div>
                <p>NEON<br />RAGAS</p>
                <div className="ft-pass-meta"><span>AUG 29</span><span>19:30</span><span>HYD</span></div>
                <div className="ft-pass-orbit"><i /><i /><i /></div>
              </div>
            </div>
            <div className="ft-rule-strip">
              <div><span>01 / Wallet limit</span><strong>10 tickets</strong></div>
              <div><span>02 / Resale ceiling</span><strong>110% max</strong></div>
              <div><span>03 / Entry rule</span><strong>One use</strong></div>
            </div>
          </section>

          <div className="ft-tabs">
            <TabList value={view} onChange={(value) => setView(value as View)} layout="fill" hasDivider size="lg">
              <Tab value="event" label="Event" />
              <Tab value="market" label="Ticket holder resale" endContent={market.length ? <Badge variant="neutral" label={market.length} /> : undefined} />
              <Tab value="tickets" label="My tickets" endContent={tickets.length ? <Badge variant="neutral" label={tickets.length} /> : undefined} />
              <Tab value="gate" label="Gate station" />
            </TabList>
          </div>

          <div className="ft-notice"><Banner status={notice.status} title={notice.title} description={notice.description} isDismissable={notice.status !== "error"} /></div>
          <section className="ft-content">{view === "event" ? renderEvent() : view === "market" ? renderMarket() : view === "tickets" ? renderTickets() : renderGate()}</section>
        </main>

        <footer className="ft-footer"><span>FairTicket® / Monad Testnet</span><span>Clear ownership. Fair resale. Verified entry.</span></footer>
      </div>
    </Theme>
  );
}
