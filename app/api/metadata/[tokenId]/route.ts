import { NextResponse } from "next/server";

const SITE_URL = "https://fairticket-monad.sujeethsai265.chatgpt.site";
const MAX_SUPPLY = 20;

export async function GET(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId: rawTokenId } = await context.params;
  const tokenId = Number(rawTokenId);

  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      name: `Neon Ragas — FairTicket #${String(tokenId).padStart(3, "0")}`,
      description:
        "A Neon Ragas admission ticket on Monad. Each holder's resale price is limited to 110% of what they paid, and entry can be checked in only once.",
      image: `${SITE_URL}/fairticket-social.png`,
      external_url: SITE_URL,
      attributes: [
        { trait_type: "Event", value: "Neon Ragas" },
        { trait_type: "Venue", value: "HITEX Arena, Hyderabad" },
        { trait_type: "Event date", value: "2026-08-29T19:30:00+05:30" },
        { trait_type: "Face value", value: "0.01 MON" },
        { trait_type: "Initial resale limit", value: "0.011 MON" },
        { trait_type: "Wallet purchase limit", value: 10, display_type: "number" },
        { trait_type: "Ticket number", value: tokenId, display_type: "number" },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
