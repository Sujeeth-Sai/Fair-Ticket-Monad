import { NextResponse } from "next/server";

const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getTransactionReceipt",
]);
const MAX_ATTEMPTS = 4;

function isRateLimited(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: number; message?: string } };
    return parsed.error?.code === -32011 || /rate|limit|busy/i.test(parsed.error?.message ?? "");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let payload: { id?: unknown; jsonrpc?: unknown; method?: unknown; params?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }

  if (typeof payload.method !== "string" || !ALLOWED_METHODS.has(payload.method)) {
    return NextResponse.json({ error: "RPC method is not allowed" }, { status: 403 });
  }

  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(MONAD_TESTNET_RPC, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
      });
      const responseBody = await upstream.text();
      const shouldRetry = upstream.status === 429 || upstream.status >= 500 || isRateLimited(responseBody);

      if (shouldRetry && attempt + 1 < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        continue;
      }

      return new Response(responseBody, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      if (attempt + 1 < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        continue;
      }
    }
  }

  return NextResponse.json(
    { error: "Monad Testnet is temporarily busy. Please retry in a few seconds." },
    { status: 503 },
  );
}
