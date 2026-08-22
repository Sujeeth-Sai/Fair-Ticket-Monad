import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fairticket-monad.sujeethsai265.chatgpt.site"),
  title: "FairTicket — Fair tickets, clear limits",
  description:
    "Controlled ticket ownership with a 10-ticket wallet limit and transparent 110% resale rule.",
  openGraph: {
    title: "FairTicket — Fair tickets, clear limits",
    description:
      "Primary sales from the organizer, ticket-holder resales capped at 110%, and one verified entry.",
    images: ["https://fairticket-monad.sujeethsai265.chatgpt.site/fairticket-social.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FairTicket — Fair tickets, clear limits",
    description:
      "A 10-ticket wallet limit, transparent ticket-holder resale rules, and one verified entry.",
    images: ["https://fairticket-monad.sujeethsai265.chatgpt.site/fairticket-social.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
