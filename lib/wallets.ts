// Multi-wallet EVM provider detection & connection registry for Veil Protocol
// Implements EIP-6963 provider announcements + injected multi-wallet detection
// Direct provider interaction without heavy 3rd-party wallet adapters

export type EvmWalletId = "metamask" | "rabby" | "coinbase" | "okx" | "trust" | "phantom";

export type EvmProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, cb: (...a: never[]) => void) => void;
  removeListener?: (event: string, cb: (...a: never[]) => void) => void;
};

export type WalletOption = {
  id: EvmWalletId;
  name: string;
  installUrl: string;
  icon: string;
};

export const EVM_WALLETS: WalletOption[] = [
  { id: "metamask", name: "MetaMask", installUrl: "https://metamask.io/download/", icon: "/wallets/metamask.svg" },
  { id: "rabby", name: "Rabby", installUrl: "https://rabby.io/", icon: "/wallets/rabby.svg" },
  { id: "coinbase", name: "Coinbase Wallet", installUrl: "https://www.coinbase.com/wallet/downloads", icon: "/wallets/coinbase.svg" },
  { id: "okx", name: "OKX Wallet", installUrl: "https://www.okx.com/web3", icon: "/wallets/okx.svg" },
  { id: "trust", name: "Trust Wallet", installUrl: "https://trustwallet.com/download", icon: "/wallets/trust.png" },
  { id: "phantom", name: "Phantom (EVM)", installUrl: "https://phantom.app/download", icon: "/wallets/phantom.svg" },
];

type Win = typeof window & {
  ethereum?: Record<string, unknown> & { providers?: Record<string, unknown>[] };
  phantom?: { ethereum?: unknown };
  rabby?: unknown;
  coinbaseWalletExtension?: unknown;
  okxwallet?: unknown;
  trustwallet?: unknown;
};

type EIP6963ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EvmProvider;
};

const announcedList: EIP6963ProviderDetail[] = [];
const subscribers = new Set<() => void>();

export function onWalletsChanged(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function requestEip6963Providers(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: unknown) => {
    const detail = (event as { detail?: EIP6963ProviderDetail }).detail;
    if (detail?.info && detail.provider) {
      const idx = announcedList.findIndex(
        (x) => x.info.uuid === detail.info.uuid || (x.info.rdns && x.info.rdns === detail.info.rdns)
      );
      if (idx >= 0) {
        announcedList[idx] = detail;
      } else {
        announcedList.push(detail);
      }
      for (const sub of subscribers) {
        try {
          sub();
        } catch {
          // ignore
        }
      }
    }
  });
  requestEip6963Providers();
}

function win(): Win | null {
  return typeof window === "undefined" ? null : (window as unknown as Win);
}

function asEvm(p: unknown): EvmProvider | null {
  if (typeof p !== "object" || p === null) return null;
  const req = (p as { request?: unknown }).request;
  return typeof req === "function" ? (p as EvmProvider) : null;
}

function evmCandidates(): unknown[] {
  const w = win();
  if (!w) return [];
  const eth = w.ethereum as (Record<string, unknown> & {
    providers?: unknown[];
    providerMap?: Map<string, unknown>;
    detected?: unknown[];
  }) | undefined;

  const multi = Array.isArray(eth?.providers) ? eth.providers : [];
  const detected = Array.isArray(eth?.detected) ? eth.detected : [];
  const mapValues = eth?.providerMap instanceof Map ? Array.from(eth.providerMap.values()) : [];

  return [
    ...multi,
    ...detected,
    ...mapValues,
    w.rabby,
    w.phantom?.ethereum,
    w.coinbaseWalletExtension,
    w.okxwallet,
    w.trustwallet,
    w.ethereum,
  ].filter((p) => p !== undefined && p !== null);
}

export function matchEvm(p: unknown, id: EvmWalletId): boolean {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  switch (id) {
    case "rabby":
      return o.isRabby === true;
    case "phantom":
      return o.isPhantom === true;
    case "metamask":
      return (
        o.isMetaMask === true &&
        !o.isPhantom &&
        !o.isRabby &&
        !o.isCoinbaseWallet &&
        !o.isCoinbaseBrowser &&
        !o.isOkxWallet &&
        !o.isTrust &&
        !o.isTrustWallet &&
        !o.isBraveWallet &&
        !o.isBitKeep &&
        !o.isBlockWallet
      );
    case "coinbase":
      return o.isCoinbaseWallet === true || o.isCoinbaseBrowser === true;
    case "okx":
      return o.isOkxWallet === true;
    case "trust":
      return o.isTrust === true || o.isTrustWallet === true;
  }
}

export function detectEvm(id: EvmWalletId): EvmProvider | null {
  for (const item of announcedList) {
    const rdns = (item.info.rdns || "").toLowerCase();
    const name = (item.info.name || "").toLowerCase();
    const p = asEvm(item.provider);
    if (!p) continue;

    if (id === "metamask" && (rdns.includes("metamask") || name.includes("metamask"))) return p;
    if (id === "rabby" && (rdns.includes("rabby") || name.includes("rabby"))) return p;
    if (id === "phantom" && (rdns.includes("phantom") || name.includes("phantom"))) return p;
    if (id === "coinbase" && (rdns.includes("coinbase") || name.includes("coinbase"))) return p;
    if (id === "okx" && (rdns.includes("okx") || name.includes("okx"))) return p;
    if (id === "trust" && (rdns.includes("trust") || name.includes("trust"))) return p;
  }

  for (const p of evmCandidates()) {
    if (matchEvm(p, id)) {
      const evm = asEvm(p);
      if (evm) return evm;
    }
  }
  return null;
}

export function detectedEvmIds(): EvmWalletId[] {
  return (EVM_WALLETS.map((w) => w.id) as EvmWalletId[]).filter((id) => detectEvm(id) !== null);
}

export function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("wallet_timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const STORE_KEY = "veil.wallet.v1";
const EVM_IDS: ReadonlySet<string> = new Set(EVM_WALLETS.map((w) => w.id));

export function isEvmAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadWallet(): { id: EvmWalletId; address: string } | null {
  try {
    const raw = store()?.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; address?: unknown };
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.id === "string" &&
      typeof parsed.address === "string" &&
      EVM_IDS.has(parsed.id) &&
      isEvmAddress(parsed.address)
    ) {
      return { id: parsed.id as EvmWalletId, address: parsed.address };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearWallet(): void {
  try {
    store()?.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("veil:walletChange", { detail: null }));
  }
}

export function saveWallet(id: EvmWalletId, address: string): void {
  try {
    store()?.setItem(STORE_KEY, JSON.stringify({ id, address }));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("veil:walletChange", { detail: { id, address } }));
  }
}

export function subscribeWalletChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("veil:walletChange", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("veil:walletChange", handler);
    window.removeEventListener("storage", handler);
  };
}

export async function ensureRobinhoodChain(provider: EvmProvider): Promise<void> {
  const chainIdHex = "0x1237"; // 4663
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: unknown) {
    if (
      switchError &&
      typeof switchError === "object" &&
      (switchError as { code?: number }).code === 4902
    ) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: "Robinhood Chain",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
            blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
          },
        ],
      });
    }
  }
}

export async function connectEvm(id: EvmWalletId): Promise<{ provider: EvmProvider; address: string }> {
  const provider = detectEvm(id);
  if (!provider) throw new Error("wallet_missing");
  let accounts: unknown;
  try {
    accounts = await withTimeout(provider.request({ method: "eth_requestAccounts" }));
  } catch (e) {
    if (e instanceof Error && /rejected|cancel|denied|user/i.test(e.message)) throw new Error("wallet_rejected");
    throw e instanceof Error ? e : new Error("wallet_failed");
  }
  const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";
  if (!isEvmAddress(address)) throw new Error("wallet_failed");
  
  await ensureRobinhoodChain(provider).catch(() => {});

  saveWallet(id, address);
  return { provider, address };
}

export async function silentEvmAccount(id: EvmWalletId): Promise<string | null> {
  const provider = detectEvm(id);
  if (!provider) return null;
  try {
    const accounts = await withTimeout(provider.request({ method: "eth_accounts" }), 5000);
    const address = Array.isArray(accounts) ? String(accounts[0] ?? "") : "";
    return isEvmAddress(address) ? address : null;
  } catch {
    return null;
  }
}

export function getActiveEvmProvider(): EvmProvider | null {
  const w = win();
  if (!w) return null;
  const stored = loadWallet();
  if (stored) {
    const p = detectEvm(stored.id);
    if (p) return p;
  }
  return asEvm(w.ethereum);
}

export function walletLabel(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "wallet_missing") return "Wallet not detected. Install extension or choose another.";
    if (e.message === "wallet_rejected") return "Connection cancelled by user.";
    if (e.message === "wallet_timeout") return "Wallet timed out. Please unlock and retry.";
    return e.message;
  }
  return "Wallet connection failed.";
}
