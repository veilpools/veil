"use client";

import React from "react";
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
              <li><a href="/trade">Swap-to-Shield</a></li>
              <li><a href="/trade">Shielded Swaps</a></li>
              <li><a href="/trade">ZK-Gated Pools</a></li>
              <li><a href="#flywheel">Buyback &amp; Burn Ledger</a></li>
            </ul>
          </nav>

          <nav className="landing-footer__column landing-footer__resources" aria-label="Developers">
            <h2>Developers</h2>
            <ul>
              <li><a href="#security">Smart Contracts</a></li>
              <li><a href="#how">Architecture</a></li>
              <li><a href="#security">CREATE2 Deployer</a></li>
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
              <li>
                <a
                  href="https://explorer.mainnet.chain.robinhood.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Blockscout Mainnet
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
              <li><a href="#security">Security & Verification</a></li>
              <li><a href="#faq">Security FAQ</a></li>
            </ul>
          </nav>

          <nav className="landing-footer__column landing-footer__legal" aria-label="Legal">
            <h2>Legal</h2>
            <ul>
              <li><a href="/privacy">Privacy Architecture</a></li>
              <li><a href="/terms">Terms of Service</a></li>
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
