import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoalBuilder — Investment Goal Planner",
  description:
    "Plan smarter. Save with purpose. Run a Monte Carlo simulation for your financial goal — house deposit, education fund, retirement, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-terminal-bg font-mono antialiased">
        {/* Subtle scanline effect for terminal atmosphere */}
        <div className="scanlines" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
