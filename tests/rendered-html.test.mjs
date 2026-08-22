import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", ...(init.headers ?? {}) },
      ...init,
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FairTicket application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FairTicket — Fair tickets, clear limits<\/title>/i);
  assert.match(html, /A better way[\s\S]*to own a[\s\S]*seat\./i);
  assert.match(html, /110%/i);
  assert.match(html, /10 tickets/i);
  assert.match(html, /Gate station/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships the contract rules required for a protected resale", async () => {
  const contract = await readFile(
    new URL("../contracts/contracts/FairTicket.sol", import.meta.url),
    "utf8",
  );

  assert.match(contract, /error DirectTransfersDisabled\(\)/);
  assert.match(contract, /error OrganizerCannotResell\(\)/);
  assert.match(contract, /price == 0 \|\| price > maximum/);
  assert.match(contract, /lifetimePurchases\[msg\.sender\] \+ quantity > maxPerWallet/);
  assert.match(contract, /function maxResalePrice/);
  assert.match(contract, /function checkInChallenge/);
  assert.match(contract, /MAX_CHECK_IN_PROOF_LIFETIME/);
  assert.match(contract, /if \(used\[tokenId\]\) revert TicketAlreadyUsed\(\)/);
});

test("serves public metadata for every valid ticket number", async () => {
  const response = await render("/api/metadata/1");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);

  const metadata = await response.json();
  assert.equal(metadata.name, "Neon Ragas — FairTicket #001");
  assert.equal(metadata.attributes.at(-1).value, 1);
  assert.match(metadata.image, /^https:\/\//);
});

test("the browser RPC bridge refuses transaction-submission methods", async () => {
  const response = await render("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendRawTransaction",
      params: ["0x00"],
    }),
  });

  assert.equal(response.status, 403);
});
