FairTicket 🎟️

Anti-Scalping Event Ticketing on Monad

FairTicket is a blockchain-based event ticketing platform designed to fight ticket scalping and black-market resale.

Instead of relying on a ticketing company to promise that tickets won’t be resold at ridiculous prices, FairTicket puts the fairness rules directly into a smart contract.

A ticket can only be resold within a predefined price cap. If someone tries to list it above that limit, the blockchain rejects the transaction automatically.

⸻

🚀 Live Demo

Live Application:
https://fairticket-monad.sujeethsai265.chatgpt.site/

⸻

🧩 The Problem

Concert and event tickets often become victims of scalping.

A limited number of tickets are released, while thousands or millions of people try to buy them at the same time. Bots and bulk buyers can acquire large numbers of tickets and later resell them at extremely inflated prices.

For example:

A ₹2,500 ticket can end up being resold for ₹35,000 or more.

This creates a system where genuine fans lose access to tickets while scalpers profit from artificial scarcity.

The bigger problem is that traditional ticketing platforms generally enforce these rules through their own private databases and policies.

FairTicket takes a different approach:

The ticket itself enforces the rules.

The original project concept specifically focuses on the Indian ticket-scalping problem and uses blockchain to make the resale rules publicly verifiable and difficult to bypass.

⸻

💡 Our Solution

FairTicket turns an event ticket into an on-chain asset with built-in rules.

The core idea:

Organizer
    ↓
Creates Event
    ↓
Sets Ticket Price + Resale Cap + Supply
    ↓
Fan buys Ticket
    ↓
Ticket belongs to Fan's Wallet
    ↓
Fan wants to resell
    ↓
┌─────────────────────────────┐
│ Is resale price within cap? │
└──────────────┬──────────────┘
               │
        ┌──────┴──────┐
        │             │
       YES            NO
        │             │
     Resale       Transaction
     allowed       rejected
        │
        ↓
 New owner receives ticket
        │
        ↓
 Wallet-based check-in
        │
        ↓
 Ticket marked as USED

The important part is that the resale restriction isn’t just a frontend validation.

The smart contract itself rejects an illegal resale.

⸻

🔥 Key Features

1. Anti-Scalping Primary Sale

Each event can define a maximum number of tickets a single wallet can purchase.

This prevents one wallet from purchasing the entire inventory during the initial sale.

maxPerWallet

If a wallet reaches its limit, another purchase is rejected by the contract.

⸻

2. Smart-Contract Enforced Resale Cap

Event organizers define a maximum resale percentage.

For example:

Original Price = ₹2,500
Maximum Resale = 110%
Maximum Allowed Price = ₹2,750

Trying to list the ticket for ₹10,000 will fail.

The contract calculates the maximum legal resale price:

resaleCap = facePrice × maxResaleBps / 10000

This is the central anti-scalping mechanism of FairTicket.

⸻

3. Direct Transfers Disabled

This is extremely important.

A normal ERC-721 NFT can generally be transferred directly from one wallet to another.

That could create a loophole:

Seller
   ↓
Direct wallet transfer
   ↓
Buyer pays seller privately
   ↓
Resale price cap bypassed

FairTicket intentionally disables direct ERC-721 transfers.

Tickets can change ownership through the controlled resale mechanism instead:

listForResale()
       ↓
buyResale()
       ↓
Contract checks price
       ↓
Ownership transferred

This closes a major loophole in the anti-scalping design.

⸻

4. Wallet-Based Ownership Verification

At the event gate, the current ticket owner connects their wallet and performs the check-in transaction.

The contract verifies:

Current wallet == Ticket owner

A forwarded screenshot or copied ticket image cannot perform the blockchain transaction from the legitimate owner’s wallet.

The project concept uses this wallet-signing/ownership model specifically to prevent a forwarded ticket representation from being used by someone who doesn’t control the current ticket wallet.

⸻

5. One-Time Check-In

Once a ticket is used:

checkedIn[tokenId] = true

The same ticket cannot be checked in again.

Attempting to reuse it causes the transaction to revert.

⸻

6. Transparent Transaction History

Ticket creation, minting, listing, resale and check-in happen through blockchain transactions.

This makes the ticket lifecycle publicly auditable instead of relying entirely on a private company database.

The project idea specifically uses this transparency as the difference between a company promising fairness and code enforcing fairness.

⸻

🏗️ Technology Stack

Blockchain

* Monad Testnet
* Solidity
* Foundry
* OpenZeppelin ERC-721
* Monad Chain ID: 10143

Frontend

* Next.js
* React
* TypeScript
* wagmi
* viem
* TanStack React Query

Wallet

* MetaMask / EVM-compatible wallet

⸻

⚙️ Architecture

                    ┌──────────────────────┐
                    │      User / Fan      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Next.js Frontend  │
                    │                      │
                    │  Event UI            │
                    │  Ticket UI           │
                    │  Resale UI            │
                    │  Check-in UI          │
                    └──────────┬───────────┘
                               │
                         wagmi / viem
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Monad Testnet      │
                    │                      │
                    │  FairTicket.sol      │
                    │                      │
                    │  Event Management    │
                    │  Ticket Minting      │
                    │  Resale Cap          │
                    │  Ownership           │
                    │  Check-in            │
                    └──────────────────────┘

⸻

📜 Smart Contract

The main contract is:

src/FairTicket.sol

The contract is an ERC-721 implementation with additional anti-scalping logic.

Main functions

Function	Purpose
createEvent()	Creates an event and defines its ticket rules
mint()	Purchases a ticket at the official face price
listForResale()	Lists a ticket for resale
buyResale()	Purchases a listed ticket
cancelListing()	Cancels a resale listing
resaleCap()	Calculates the maximum legal resale price
checkIn()	Checks the current ticket owner into the event

⸻

🔐 Fairness Rules

Every event can define:

Face Price
Maximum Resale %
Maximum Supply
Maximum Tickets / Wallet

Example:

Event: Hyderabad Music Fest
Face Price: ₹2,500
Resale Cap: 110%
Maximum Resale: ₹2,750
Supply: 500
Wallet Limit: 2

A user can therefore:

BUY ₹2,500
   ↓
RESALE ₹2,750 ✅

But:

RESALE ₹10,000 ❌

The second transaction is rejected by the smart contract.

⸻

🧪 Example Demo Flow

The strongest way to demonstrate FairTicket during a hackathon is:

Step 1 — Create Event

Organizer creates an event with:

Ticket price: 1 MON
Resale cap: 110%
Supply: 500
Wallet limit: 2

Step 2 — Buy Ticket

Connect Wallet A and mint a ticket.

The ticket becomes owned by Wallet A.

Step 3 — Try to Scalper-Resell

Wallet A attempts:

Original Price: 1 MON
Resale Price:
10 MON

Result:

❌ TRANSACTION REJECTED
Price exceeds resale cap

Step 4 — Fair Resale

Wallet A lists the ticket within the allowed limit.

Wallet B purchases it.

Wallet A
   ↓
Fair Resale
   ↓
Wallet B

Step 5 — Check In

Wallet B connects at the gate and checks in.

The contract verifies ownership and marks the ticket as used.

Step 6 — Try Reuse

Attempting to check in again:

❌ TRANSACTION REJECTED
Ticket already checked in

This gives judges a very clear live demonstration of the core idea.

⸻

🛡️ Why Blockchain?

A traditional application could implement a resale price check.

The problem is that the rule would live inside the company’s backend.

FairTicket moves the critical rule into public smart-contract code.

Traditional System
User
 ↓
Frontend
 ↓
Private Backend
 ↓
Private Database
 ↓
Decision

Versus:

FairTicket
User
 ↓
Frontend
 ↓
Smart Contract
 ↓
Blockchain
 ↓
Rule enforced by code

The goal isn’t to use blockchain simply because it is blockchain.

The blockchain is being used for the specific properties that matter here:

* Public verification
* Immutable transaction history
* Wallet-based ownership
* Smart-contract enforcement
* No centralized override of the resale-cap rule

The project document frames this as the key reason blockchain is relevant: the fairness rule should not depend on the platform’s willingness to enforce it.

⸻

⚡ Why Monad?

Ticket sales create a particularly difficult workload:

Thousands / Millions of users
            ↓
     Simultaneous demand
            ↓
   Huge number of transactions

The project targets Monad because the on-sale moment involves a large number of mostly independent purchase attempts.

The project concept specifically positions Monad’s high-throughput, low-cost execution as a fit for this type of sudden transaction demand.

⸻

📁 Project Structure

fair-ticket/
│
├── src/
│   └── FairTicket.sol
│
├── script/
│   └── Deploy.s.sol
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── providers.tsx
│   │   └── globals.css
│   │
│   ├── lib/
│   │   ├── wagmi.ts
│   │   └── contract.ts
│   │
│   ├── package.json
│   └── next.config.js
│
├── foundry.toml
├── remappings.txt
└── README.md

⸻

🚀 Run Locally

Prerequisites

Install:

* Node.js
* npm
* Foundry
* MetaMask or another EVM wallet

⸻

Clone Repository

git clone <YOUR_GITHUB_REPOSITORY_URL>
cd fair-ticket

⸻

Install Frontend Dependencies

cd frontend
npm install

Run the frontend:

npm run dev

The application will be available locally at:

http://localhost:3000

⸻

Build Smart Contract

From the project root:

forge build

⸻

Deploy to Monad Testnet

Set your wallet private key:

export PRIVATE_KEY=your_testnet_private_key

Then deploy:

forge script script/Deploy.s.sol \
  --rpc-url monad_testnet \
  --broadcast

Never commit your private key to GitHub.

⸻

🌐 Monad Testnet

Network: Monad Testnet
Chain ID: 10143
RPC: https://testnet-rpc.monad.xyz
Explorer: https://testnet.monadexplorer.com

For testing, use testnet MON rather than real funds.

⸻

🎯 Hackathon Goal

FairTicket is built for Monad Blitz Hyderabad V3.

The goal is to demonstrate a simple but powerful idea:

A ticket should not need to trust a platform to remain fair. The ticket should enforce the rule itself.

The project focuses on one clear problem:

Stopping large-scale ticket scalping and preventing legitimate fans from being priced out by extreme resale prices.

⸻

⚠️ Current Limitations

FairTicket is a hackathon prototype, not a production-ready ticketing platform.

There are still real-world problems to solve.

Off-platform deals

No system can completely prevent someone from making a private agreement outside the platform.

For example:

Person A owns ticket
        ↓
Person A sells login/access privately
        ↓
Payment happens outside FairTicket

The project therefore focuses on eliminating the easy, scalable form of public scalping rather than claiming to eliminate every possible form of fraud. The original design explicitly acknowledges this limitation.

Production deployment

A real deployment would also require:

* Event organizer integration
* Production-grade gate scanning
* Identity/privacy design
* Security audits
* Legal review
* Real payment integration
* High-volume load testing

The hackathon version uses Monad Testnet and test funds.

⸻

🔮 Future Improvements

Potential future versions could include:

* Dynamic event discovery
* QR + wallet verification
* Mobile application
* Organizer dashboard
* Multiple ticket categories
* Seat-level ticketing
* Refund mechanisms
* Event cancellation handling
* Secondary-market analytics
* Fraud detection
* Sybil/bot resistance
* Zero-knowledge identity verification
* Production payment integration
* Real-world venue gate scanners

⸻

🏆 Why FairTicket?

Most ticketing systems ask users to trust the platform.

FairTicket asks users to trust the rules encoded in the contract.

Traditional Ticketing
"Trust us.
We won't allow unfair resale."
              vs.
FairTicket
"Try to break the rule.
The contract won't let you."

That’s the fundamental idea behind FairTicket.

⸻

👥 Team

Team Rockerz

Built for:

Monad Blitz Hyderabad V3 — August 2026

⸻

📄 License

This project is released under the MIT License.
