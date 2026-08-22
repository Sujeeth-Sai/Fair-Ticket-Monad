# FairTicket

FairTicket is a Monad ticketing app where the resale rules are enforced by
the smart contract itself, not by platform policy. Tickets are ERC-721
tokens. Ordinary wallet-to-wallet transfers are disabled entirely — the only
way a ticket can change hands after minting is through the contract's own
protected resale marketplace, which refuses any listing priced above the
allowed cap.

## ⚠️ Before you demo: on-chain vs. displayed limit mismatch

Verified directly against the live contract on Monad Testnet just now:

| | Frontend copy (`app/page.tsx`, `app/layout.tsx`) | Actual deployed contract |
|---|---|---|
| Per-wallet lifetime ticket limit | **10 tickets** | **2 tickets** |

The Hardhat Ignition module's default was changed to `10n` at some point, but
the contract at the address below was deployed *before* that change and was
never redeployed. If a judge tries to buy a 3rd ticket during a live demo on
this address, it will revert — directly contradicting the "10 tickets" text
on screen. Fix by either redeploying with the current module (matches the
displayed copy) or editing the copy back down to 2 (matches this deployment).
Confirm which one before you go on stage.

## Live deployment (Monad Testnet)

- **Contract address:** `0x5d91c595b263469059c9494a7c40600d4a061146`
- **Chain ID:** `10143`
- **Explorer:** https://fairticket-monad.sujeethsai265.chatgpt.site
- **Organizer / owner wallet:** `0xCCf414e9c596C2C3754F2557785E130023cAA9A7`
- **Event configured:** "Neon Ragas" · HITEX Arena, Hyderabad · 20 max supply · 0.01 MON face value · 10% resale markup

(Live-verified: `totalMinted` currently reads `2` on-chain — two tickets have
already been minted against this deployment, most likely from earlier testing.)

## What's actually enforced on-chain

- **`buyPrimary(quantity)`** — mints at a fixed face price. Reverts past
  `maxSupply` or past the caller's lifetime wallet limit.
- **`listForResale(tokenId, price)`** — lists a ticket for resale. Reverts if
  the price exceeds `maxResalePrice(tokenId)`. That cap is **dynamic**: it's
  calculated from whatever the *current* owner actually paid to acquire the
  ticket (their `acquisitionPrice`), plus the markup — not a flat cap off the
  original face value. So the ceiling can drift slightly with each resale,
  always relative to the last real sale price.
- **`buyResale(tokenId)`** — buys a listed ticket. Funds are held in the
  contract as `sellerProceeds`, withdrawn separately (pull-payment pattern,
  not an automatic push) via `withdrawSellerProceeds()`.
- **The organizer cannot resell.** `listForResale` explicitly reverts with
  `OrganizerCannotResell()` if called by the contract owner.
- **`checkIn(tokenId, deadline, signature)`** — callable only by the
  organizer wallet, and only succeeds if the ticket's *current* owner signed
  a fresh challenge for this specific token, deadline, and ownership state
  (`ownershipNonces` increments on every resale, so a signature can't be
  replayed after a ticket changes hands). Deadlines are capped at 10 minutes
  out (`MAX_CHECK_IN_PROOF_LIFETIME`), and a ticket can only ever be checked
  in once.
- **Direct ERC-721 transfers, `approve`, and `setApprovalForAll` are all
  disabled** — overridden to revert. The resale marketplace is the only path
  ownership can move through.

## App structure

Four views in one page (`app/page.tsx`): **Event** (buy primary), **Ticket
holder resale** (browse and buy listings), **My tickets** (list for resale,
sign a gate-entry proof, claim resale proceeds), and **Gate station**
(organizer-only: paste an attendee's signed proof, verify, check in,
withdraw organizer proceeds).

The app runs in a **transaction-free guided demo mode** by default. Setting
`NEXT_PUBLIC_FAIR_TICKET_ADDRESS` switches it to live mode against a real
deployed contract. Wallet connection uses EIP-6963 provider discovery
(detects MetaMask specifically among multiple installed wallets, not just
whichever injects first).

## Tech stack

- **Contracts:** Solidity 0.8.28, OpenZeppelin (Ownable, Pausable,
  ReentrancyGuard, ECDSA), Hardhat + Hardhat Ignition for deployment.
- **Frontend:** Next.js on Cloudflare Workers (via `vinext` + Wrangler), the
  Astryx component library for UI, viem for all contract reads/writes.
- **RPC handling:** requests are proxied through `app/api/rpc/route.ts`
  server-side, with retry/backoff on rate-limit responses — addresses the
  known low rate limits on Monad's public testnet RPC endpoints directly,
  rather than hitting them from the browser.
- **Metadata:** served per-token from `app/api/metadata/[tokenId]/route.ts`.

## Run it yourself

```bash
npm install
npm run dev
```

Starts in guided demo mode — fully interactive, no wallet or transactions
required. To point it at the live deployment above, add to `.env.local`:

```bash
NEXT_PUBLIC_FAIR_TICKET_ADDRESS=0x5d91c595b263469059c9494a7c40600d4a061146
```

### Contracts

```bash
cd contracts
npm install
npm test
npm run compile
```

To redeploy (e.g. to fix the wallet-limit mismatch above):

```bash
npx hardhat keystore set PRIVATE_KEY
npm run deploy:testnet
```

Never commit a private key, seed phrase, or keystore password. After
redeploying, update `NEXT_PUBLIC_FAIR_TICKET_ADDRESS` and the fallback in
`lib/fair-ticket.ts` with the new address.

## Known limitation

The contract enforces the price paid through its own on-chain marketplace.
Like any ticket protocol, it cannot stop two parties from privately arranging
an additional off-chain side payment alongside an on-chain sale at the
capped price.

## Operational note

This is a Monad Testnet hackathon build. A real-money version would
additionally need a cancellation/refund policy, separated treasury and gate
operator roles, legal review, and an independent contract audit before
handling real funds.
