import type { Metadata } from "next";
import { Providers } from "./providers";
import SceneBackground from "@/components/SceneBackground";
import LoadingScreen from "@/components/LoadingScreen";
import "./globals.css";
import "./landing.css";
import "./dapp.css";

export const metadata: Metadata = {
  title: "stockNFT · Tokenized Stocks on Robinhood Chain",
  description: "Mint tokenized stock shares as NFTs on Robinhood Chain. Own, trade, and redeem real-world asset exposure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Icons+Round" />
        <link rel="icon" type="image/jpeg" href="/logo.jpg" />
      </head>
      <body suppressHydrationWarning>
        <SceneBackground />
        <LoadingScreen />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
