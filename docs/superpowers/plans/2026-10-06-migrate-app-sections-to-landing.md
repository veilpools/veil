# Migrate App Informational Pages to Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate all protocol information, tokenomics flywheel, verified contract registries, and compliance telemetry from secondary app routes (`/burn`, `/status`, `/contracts`) directly into the landing page, transforming `/trade` into a dedicated, distraction-free Privacy Terminal.

**Architecture:** 
1. Create `FlywheelBurnSection.tsx` on the landing page integrating live burn KPIs, the dual-source fee flywheel, and on-chain burn events.
2. Expand `ContractsSecuritySection.tsx` into a unified security, contract registry (all 7 contracts with full 42-char addresses), LeanIMT Merkle telemetry, and DevBrief §7 acceptance matrix.
3. Integrate these into `components/landing/App.tsx` and update `Header.tsx` anchor navigation.
4. Streamline `components/Navbar.tsx` so `/trade` operates as a focused terminal.
5. Set up clean Next.js client redirects on `/burn`, `/status`, and `/contracts` pointing to their respective landing page anchors (`/#flywheel`, `/#security`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, GSAP ScrollTrigger, CSS custom properties (`tokens.css`, `animations.css`).

## Global Constraints
- **Zero Indonesian language in code, UI text, or comments** — all copy strictly in technical, high-conviction English.
- **No checkmark icons (`✓`) and no `#00c22d` green dots** — use warm editorial brutalist styling (`#FF8C00`, `GT Alpina Typewriter`, monochrome accents).
- **TypeScript strictness** — must pass `npx tsc --noEmit` with 0 errors.
- **No dev server restarts, no `pnpm test`, no `pnpm build`**.

---

### Task 1: Create `FlywheelBurnSection.tsx` for the Landing Page

**Files:**
- Create: `components/landing/components/FlywheelBurnSection.tsx`
- Modify: `components/landing/styles/animations.css` (if additional styles needed)

**Interfaces:**
- Consumes: `SectionHeader`, `RevealBox` from `components/landing/components/`
- Produces: `FlywheelBurnSection: React.FC`

- [ ] **Step 1: Write `FlywheelBurnSection.tsx`**
Implement the component with:
- Section ID: `#flywheel`
- SectionHeader: kicker="Protocol Flywheel", title="Deflationary by design. Zero speculation reliance.", sub="All burns execute on-chain via native burn() calls permanently reducing totalSupply, funded by Uniswap v4 hook swap fees and creator royalties."
- 3 KPI metric cards (Total Tokens Burned: `12,450,000 VEIL`, Cumulative Buyback: `3.42 ETH`, Treasury Pending Buyback: `0.85 ETH`).
- Dual-Source Revenue Card in obsidian style (VeilHook 30 bps swap fee + Pons Creator Fee).
- On-chain Burn Proof Events table (3 transactions with full hashes, amounts, timestamps, block numbers, Blockscout links).

- [ ] **Step 2: Verify TypeScript compiles**
Run: `npx tsc --noEmit`

---

### Task 2: Expand `ContractsSecuritySection.tsx` with Telemetry, Full Registry & Acceptance Matrix

**Files:**
- Modify: `components/landing/components/ContractsSecuritySection.tsx`

**Interfaces:**
- Consumes: Design tokens (`tokens.css`), Blockscout explorer URLs
- Produces: `ContractsSecuritySection: React.FC`

- [ ] **Step 1: Expand `ContractsSecuritySection.tsx`**
Update the component to include:
- Part 1: Security Pillars (Formal Verification, Non-Custodial Invariant, Association Set Proof, Renounceable Guardian).
- Part 2: LeanIMT Merkle Telemetry & Association Set IPFS CID Card (`21888242...` root, CID `QmVtkNm5Ro2F1oVBdP17TxcAcafXtMoG8rYPnu7S8kXJxV` with direct IPFS verification link).
- Part 3: Full Contract Registry (Tabbed or grouped into "Core Protocol" [VeilHook, VeilShieldRouter, ShieldedPool_ETH, VeilTreasury] and "Uniswap v4 Dependencies" [PoolManager, PositionManager, UniversalRouter]) with 42-character full addresses and 1-click copy.
- Part 4: DevBrief §7 Acceptance Test Matrix (Collapsible or structured view of all 10 verified on-chain test vectors).

- [ ] **Step 2: Verify TypeScript compiles**
Run: `npx tsc --noEmit`

---

### Task 3: Integrate New Sections and Update Header Navigation

**Files:**
- Modify: `components/landing/App.tsx`
- Modify: `components/landing/components/Header.tsx`

**Interfaces:**
- Consumes: `FlywheelBurnSection`, `ContractsSecuritySection`
- Produces: Updated landing page structure

- [ ] **Step 1: Add `FlywheelBurnSection` to `App.tsx`**
Mount `FlywheelBurnSection` between `HowItWorksSection` and `ContractsSecuritySection`.
- [ ] **Step 2: Update navigation links in `Header.tsx`**
Ensure links match:
- How It Works (`#how-it-works`)
- Why Veil (`#why-veil`)
- Flywheel (`#flywheel`)
- Contracts & Status (`#security`)
- FAQ (`#faq`)
- Launch App button (`/trade`)

- [ ] **Step 3: Verify TypeScript compiles**
Run: `npx tsc --noEmit`

---

### Task 4: Streamline App Terminal Navigation in `Navbar.tsx`

**Files:**
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Consumes: `usePathname` from `next/navigation`
- Produces: Cleaned `Navbar` component

- [ ] **Step 1: Update `components/Navbar.tsx`**
- Remove secondary route tabs (`/burn`, `/status`, `/contracts`) from the app navbar.
- Provide a clean brand mark linking to `/`, a "Protocol Overview" backlink pointing to `/#flywheel`, Network Status indicator (`Robinhood Chain 4663`), and Wallet Connect button.

- [ ] **Step 2: Verify TypeScript compiles**
Run: `npx tsc --noEmit`

---

### Task 5: Setup Route Redirects on `/burn`, `/status`, and `/contracts`

**Files:**
- Modify: `app/burn/page.tsx`
- Modify: `app/status/page.tsx`
- Modify: `app/contracts/page.tsx`

**Interfaces:**
- Consumes: `useEffect`, `useRouter` from `next/navigation`
- Produces: Instant client-side redirect to landing anchors (`/#flywheel`, `/#security`)

- [ ] **Step 1: Implement redirection in secondary route pages**
Redirect each route smoothly to its corresponding section on the landing page, providing an instant fallback link in case script redirection is delayed.

- [ ] **Step 2: Run final verification**
Run: `npx tsc --noEmit`
