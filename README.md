# FairTicket

FairTicket is a Monad-ready ticketing app with clear rules enforced by an
ERC-721 smart contract. Each wallet can buy at most 10 tickets in total. A
ticket holder can resell a ticket for no more than 110% of the price they paid,
while the organizer cannot use the resale market. Direct wallet transfers are
disabled, so ownership can only move through the protected resale function.
Gate entry requires a short-lived signature from the current owner and can be
recorded only once.

## Run the web app

```bash
npm install
npm run dev
```

The presentation build starts in a fully interactive, transaction-free guided
demo mode. To connect it to a
deployed contract, set this in `.env.local`:

```bash
NEXT_PUBLIC_FAIR_TICKET_ADDRESS=0xYourContractAddress
```

## Compile and test the contract

```bash
cd contracts
npm install
npm test
```

The default deployment module creates a 20-ticket "Neon Ragas" event with a
0.01 MON face price, a 10-ticket lifetime purchase limit per wallet, and a 10%
resale markup limit based on the current holder's purchase price. Ticket
metadata is served from `/api/metadata/[tokenId]`.

## Deploy to Monad Testnet

Use a dedicated, funded testnet wallet. Store its key in Hardhat's encrypted
keystore rather than in source control:

```bash
cd contracts
npx hardhat keystore set PRIVATE_KEY
npm run deploy:testnet
```

After deployment, copy the returned FairTicket address into `.env.local` for
local testing and into the public fallback in `lib/fair-ticket.ts` for a
reproducible hosted build. Then verify primary purchase, rejected over-cap
resale, protected resale, seller claim, signed proof, one-time check-in, and
organizer withdrawal with separate test wallets.

## Important limitation

The contract enforces the price paid through its on-chain marketplace. Like
all ticket protocols, it cannot stop parties from arranging an additional
off-chain side payment.
