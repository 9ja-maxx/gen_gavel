import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GenGavel - Decentralized SLA Escrow & Arbitration",
  description: "Objective agreement arbitration powered by decentralized AI consensus on GenLayer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#060913" }}>
        {children}
      </body>
    </html>
  );
}
