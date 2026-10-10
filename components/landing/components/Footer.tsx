"use client";

import React from "react";
import Link from "next/link";
import { VeilLogo } from "../../VeilLogo";

export const Footer: React.FC = () => {
  return (
    <footer id="footer" className="landing-footer" aria-label="Site footer">
      <div className="landing-footer__inner">
        <div className="landing-footer__grid">
          <div className="landing-footer__brand">
            <VeilLogo href="/" size="lg" color="#ffffff" />
            <p>Zero-Knowledge privacy layer for Uniswap v4 on Robinhood Chain.</p>
            <a className="landing-footer__email" href="https://x.com/veilpools" target="_blank" rel="noopener noreferrer">
              Follow @veilpools
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </a>
          </div>

          <nav className="landing-footer__column landing-footer__solutions" aria-label="Protocol">
            <h2>Protocol</h2>
            <ul>
              <li><Link href="/trade">Swap-to-Shield</Link></li>
              <li><Link href="/trade">Shielded Swaps</Link></li>
              <li><Link href="/trade">ZK-Gated Pools</Link></li>
              <li><Link href="/burn">Treasury &amp; Burn Ledger</Link></li>
            </ul>
          </nav>

          <nav className="landing-footer__column landing-footer__resources" aria-label="Developers">
            <h2>Developers</h2>
            <ul>
              <li><Link href="/contracts">Smart Contracts</Link></li>
              <li><Link href="/docs/asp-policy">Association Set Policy</Link></li>
              <li><Link href="/docs/decisions">Owner Decisions</Link></li>
              <li>
                <a href="https://github.com/veilpools/veil" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </nav>

          <nav className="landing-footer__column landing-footer__company" aria-label="Security">
            <h2>Security</h2>
            <ul>
              <li><Link href="/status">Chain &amp; Pool Health</Link></li>
              <li><Link href="/contracts">Contract Deployments</Link></li>
              <li>
                <a
                  href="https://explorer.mainnet.chain.robinhood.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mainnet Explorer
                </a>
              </li>
              <li>
                <a
                  href="https://explorer.testnet.chain.robinhood.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Testnet Explorer
                </a>
              </li>
            </ul>
          </nav>

          <nav className="landing-footer__column landing-footer__legal" aria-label="Legal">
            <h2>Legal</h2>
            <ul>
              <li><Link href="/privacy">Privacy Architecture</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/docs/asp-policy">ASP Compliance</Link></li>
            </ul>
          </nav>
        </div>

        <div className="landing-footer__bottom">
          <p>© 2026 Veil Protocol. All rights reserved.</p>
          <div className="landing-footer__socials">
            <a
              href="https://x.com/veilpools"
              target="_blank"
              rel="noopener noreferrer"
            >
              X (Twitter)
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </a>
            <a
              href="https://github.com/veilpools/veil"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
