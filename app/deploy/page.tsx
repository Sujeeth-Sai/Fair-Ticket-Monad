import Link from "next/link";

export default function DeployPage() {
  return (
    <main style={{ maxWidth: 640, margin: "96px auto", padding: 32 }}>
      <p className="ft-panel-label">PRESENTATION MODE</p>
      <h1 style={{ fontSize: 56, letterSpacing: "-0.06em", lineHeight: 0.95, margin: "18px 0" }}>
        FairTicket is ready.
      </h1>
      <p style={{ color: "#4b4c46", lineHeight: 1.7 }}>
        The public presentation uses the complete transaction-free demo, so every ticket flow works without a wallet failure.
      </p>
      <Link href="/" style={{ display: "inline-block", marginTop: 20, padding: "13px 18px", borderRadius: 999, color: "white", background: "#4646e8", textDecoration: "none", fontWeight: 700 }}>
        Open FairTicket
      </Link>
    </main>
  );
}
