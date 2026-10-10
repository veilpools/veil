export const codosContent = {
  hero: {
    badge: "ZK Privacy Layer for Uniswap v4 on Robinhood Chain",
    headline: {
      line1: "private",
      line2: "execution"
    },
    tagline: "Zero-knowledge private swaps and non-custodial shielded pools on Robinhood Chain.",
    sub: "Swap-to-Shield, ZK-gated pools, and MEV-proof execution powered by Uniswap v4 custom hooks.",
    ctaPrimary: "Launch App",
    ctaSecondary: "View Contracts",
    socialProof: {
      backedBy: {
        label: "Backed by",
        logos: ["paradigm"]
      },
      buildersFrom: {
        label: "Builders from",
        logos: ["uniswap", "robinhood", "ethereum"]
      }
    }
  },
  problem: {
    kicker: "THE PROBLEM",
    statements: [
      {
        head: "Every public trade is a target for exploitation.",
        sub: "Public mempools expose your order details to predatory bots before execution."
      },
      {
        head: "MEV bots and surveillance drain your alpha.",
        sub: "Sandwich attacks and copy-traders front-run your strategies."
      },
      {
        head: "Veil shields your assets the instant you swap.",
        sub: "Uniswap v4 liquidity with zero-knowledge private settlement."
      }
    ]
  },
  setupLead: "Here’s how Veil works.",
  steps: [
    {
      number: "Step 1",
      title: "Deposit once and shield into the pool",
      badge: "Non-custodial shielded deposit",
      sessionId: "Note #4611 · 0.001 ETH",
      sampleQuote: "Commitment generated. Your note is cryptographically committed into the 0xbow pool, verified against published Association Sets.",
      controls: ["Note encrypted", "Association Set (ASP)", "Robinhood Chain", "Encrypted vault backup", "Shield"]
    },
    {
      number: "Step 2",
      title: "Zero-knowledge proofs route your trade through Uniswap v4",
      badge: "Atomic private execution",
      desc: "Your browser proves note ownership via client-side Groth16 zk-SNARKs. The Veil hook and router verify proof context on-chain, swap on Uniswap v4, and re-shield the output."
    },
    {
      number: "Step 3",
      title: "Exit to a fresh address with unlinked settlement",
      badge: "Self-relay or broadcast",
      desc: "Withdraw via browser self-relay or relayer to any fresh address. On-chain, Groth16 proves validity with zero link back to your depositor wallet."
    },
    {
      number: "Step 4",
      title: "Monitor shielded balances and protocol burn in real time",
      badge: "Zero-custody vault & burn engine",
      desc: "Track your encrypted notes, verified Association Set Merkle roots, and autonomous fee buybacks with real-time on-chain transparency."
    }
  ],
  whoItIsFor: {
    kicker: "WHO IT'S FOR",
    title: "Built for traders and protocols who cannot afford public exposure.",
    cards: [
      {
        title: "Systematic & Alpha Traders",
        range: "Proprietary Strategies",
        body: "Prevent MEV bots, sandwich searchers, and copy-traders from front-running your entries and draining your alpha before execution."
      },
      {
        title: "Whales & Institutional Capital",
        range: "Zero Market Impact",
        body: "Swap institutional volume across Uniswap v4 pools without public signaling, predatory re-pricing, or moving market sentiment against yourself."
      },
      {
        title: "Everyday DeFi Users",
        range: "Total Sovereignty",
        body: "Trade crypto and tokenized assets on Robinhood Chain with total privacy. Keep your balances and transaction history strictly confidential."
      }
    ]
  },
  comparison: {
    kicker: "WHY VEIL",
    title: "Trade on public pools. Or don't.",
    subtitle: "A frank comparison.",
    rows: [
      {
        metric: "Mempool exposure",
        diy: "100% visible to bots",
        veil: "Zero (encrypted notes)"
      },
      {
        metric: "MEV vulnerability",
        diy: "Guaranteed on size",
        veil: "Eliminated by design"
      },
      {
        metric: "Liquidity depth",
        diy: "Standard Uniswap pools",
        veil: "Identical (v4 hook routing)"
      },
      {
        metric: "Wallet linkability",
        diy: "Permanent on explorer",
        veil: "Zero link via relayers"
      },
      {
        metric: "Asset custody",
        diy: "Non-custodial",
        veil: "0 held balance (LeanIMT)"
      }
    ]
  },
  howItWorks: {
    kicker: "ARCHITECTURE",
    title: "From testnet to mainnet — verifiable on-chain.",
    steps: [
      {
        time: "Phase 1",
        name: "Swap-to-Shield",
        body: "1-Tx atomic swap on Uniswap v4 directly into LeanIMT shielded pool with strict 0-held custody invariant.",
        barW: "24%",
        indent: "0%"
      },
      {
        time: "Phase 2",
        name: "ZK-Gated Hooks",
        body: "Uniswap v4 beforeSwap hook enforcing open self-attestation gating and protocol fee buyback/burn engine.",
        barW: "38%",
        indent: "24%"
      },
      {
        time: "Phase 3",
        name: "Shielded Swaps",
        body: "Private pool-to-pool token swaps and unlinked withdrawals on Robinhood Chain via self-relay.",
        barW: "48%",
        indent: "52%"
      }
    ]
  },
  team: {
    kicker: "BUILDERS",
    title: "Cryptography meets Uniswap v4 engineering.",
    members: [
      {
        name: "Dima Khanarin",
        role: "Protocol Lead",
        background: "Former researcher at Everclear Foundation. Specializing in cross-chain zero-knowledge systems.",
        photo: "/assets/dima-updated.jpg"
      },
      {
        name: "Gleb Sidora",
        role: "ZK Engineering Lead",
        background: "Zero-knowledge proofs and cryptography. Previously built distributed systems at Meta.",
        photo: "/assets/gleb-updated.jpg"
      },
      {
        name: "Rahul Sethuram",
        role: "Uniswap v4 Architect",
        background: "Co-founder & smart contract architect. Designed decentralized execution protocols and v4 hooks.",
        photo: "/assets/rahul-updated.jpg"
      },
      {
        name: "Kevin Simback",
        role: "Protocol Operations",
        background: "Protocol operations and ecosystem growth. Scaling on-chain liquidity on Robinhood Chain.",
        photo: "/assets/kevin-simback.jpg"
      }
    ]
  },
  faq: {
    kicker: "FAQ",
    title: "Frequently asked questions.",
    items: [
      {
        q: "How does Veil guarantee privacy on a public blockchain?",
        a: "Veil shields assets in fixed-denomination Merkle pools. When you deposit, only a commitment enters the onchain tree while the secret stays in your browser; the withdraw call carries no depositor address. The onchain verifier is provisional for old notes only; Groth16 serves the live 0xbow paths."
      },
      {
        q: "Can MEV bots or sandwich searchers front-run my swap?",
        a: "No. With Swap-to-Shield and Shielded Swaps, your order details and commitment never enter the public mempool as an unshielded trade. Swaps are settled atomically via our non-custodial Uniswap v4 hook, eliminating sandwich opportunities completely."
      },
      {
        q: "What chains are supported?",
        a: "Veil is natively deployed on Robinhood Chain (Testnet 46630 fresh suite live and Mainnet 4663 deployment ready) leveraging Uniswap v4's custom hook architecture for high-throughput, low-fee execution."
      },
      {
        q: "Can anyone freeze my funds or block withdrawals?",
        a: "Never. Veil smart contracts enforce non-blocking withdrawals. While a protocol guardian can pause new deposits in an emergency, withdrawals can never be paused, censored, or frozen under any circumstance."
      }
    ]
  },
  closing: {
    title: "Ready to trade with true zero-knowledge privacy?",
    sub: "Experience atomic Swap-to-Shield and private Uniswap v4 execution on Robinhood Chain.",
    ctaPrimary: "Launch App",
    ctaSecondary: "View Contracts"
  },
  footer: {
    tagline: "Zero-Knowledge privacy layer for Uniswap v4 on Robinhood Chain.",
    email: "contact@veilpools.org",
    columns: [
      {
        title: "Protocol",
        links: ["Swap-to-Shield", "Shielded Swaps", "ZK-Gated Pools", "Buyback & Burn"]
      },
      {
        title: "Developers",
        links: ["Smart Contracts", "Documentation", "CREATE2 Deployer", "GitHub"]
      },
      {
        title: "Security",
        links: ["Blockscout Explorer", "Bug Bounty", "Association Sets"]
      },
      {
        title: "Legal",
        links: ["Terms of Use", "Privacy Architecture"]
      }
    ]
  }
};
