"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BOOT_LINES = [
  "GOALBUILDER v1.0.0",
  "─────────────────────────────────────────",
  "Initializing Monte Carlo engine...  [OK]",
  "Loading market benchmark data...    [OK]",
  "Checking rate limits...             [OK]",
  "─────────────────────────────────────────",
  "",
  "Plan smarter. Save with purpose.",
  "",
  "> Press [ENTER] or click below to begin",
];

export default function LandingPage() {
  const router = useRouter();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  // Reveal boot lines one by one
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setVisibleLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Allow Enter key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && done) router.push("/compute");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [done, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl">
        {/* Terminal window */}
        <div className="border border-terminal-border bg-terminal-surface">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-terminal-border px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-dim" />
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-dim" />
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-dim" />
            <span className="ml-auto text-[10px] text-terminal-muted tracking-widest">
              goalbuilder — bash
            </span>
          </div>

          {/* Terminal output */}
          <div className="p-6 min-h-[280px]">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className="fade-in leading-relaxed"
                style={{ animationDelay: `${i * 0.02}s` }}
              >
                {line === "" ? (
                  <br />
                ) : i === 0 ? (
                  <span className="text-terminal-white font-bold text-lg">{line}</span>
                ) : line.startsWith(">") ? (
                  <span className="text-terminal-text">{line}</span>
                ) : line.startsWith("─") ? (
                  <span className="text-terminal-dim">{line}</span>
                ) : line.includes("[OK]") ? (
                  <span className="text-terminal-muted">
                    {line.replace("[OK]", "")}
                    <span className="text-chart-green">[OK]</span>
                  </span>
                ) : (
                  <span className="text-terminal-text">{line}</span>
                )}
              </div>
            ))}

            {/* Blinking cursor */}
            {!done && (
              <span className="inline-block w-2 h-4 bg-terminal-white animate-blink" />
            )}
          </div>
        </div>

        {/* CTA */}
        {done && (
          <div className="mt-6 fade-in flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/compute")}
              className="btn btn-primary flex-1 text-center"
            >
              [ START PLANNING ]
            </button>
            <a
              href="https://github.com/goalbuilder/goalbuilder"
              target="_blank"
              rel="noopener noreferrer"
              className="btn flex-1 text-center text-terminal-muted hover:text-terminal-white"
            >
              [ VIEW SOURCE ]
            </a>
          </div>
        )}

        {/* Tagline */}
        {done && (
          <p className="mt-6 text-center text-[11px] text-terminal-muted fade-in">
            Free & open source · Educational use only · No account required
          </p>
        )}
      </div>
    </main>
  );
}
