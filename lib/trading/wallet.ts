export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
}

import { getAddress } from 'viem';

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function hasEvmWallet(): boolean {
  return getProviderCandidates().length > 0;
}

let activeProvider: Eip1193Provider | null = null;
let connectInFlight: Promise<string> | null = null;

function getProviderCandidates(): Eip1193Provider[] {
  if (typeof window === 'undefined') return [];
  const out: Eip1193Provider[] = [];
  const seen = new Set<Eip1193Provider>();

  const push = (provider: Eip1193Provider | undefined) => {
    if (!provider || seen.has(provider)) return;
    seen.add(provider);
    out.push(provider);
  };

  const eth = window.ethereum;
  if (eth) {
    push(eth);
    if (Array.isArray(eth.providers)) {
      eth.providers.forEach(p => push(p));
    }
  }

  const anyWin = window as Window & {
    okxwallet?: Eip1193Provider;
    coinbaseWalletExtension?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
  };
  push(anyWin.okxwallet);
  push(anyWin.coinbaseWalletExtension);
  push(anyWin.phantom?.ethereum);

  return out;
}

function getProvider(): Eip1193Provider | null {
  if (activeProvider) return activeProvider;
  const candidates = getProviderCandidates();
  if (candidates.length === 0) return null;

  const preferred = candidates.find(
    p => p.isMetaMask || p.isCoinbaseWallet || p.isRabby || p.isTrust,
  );
  return preferred ?? candidates[0] ?? null;
}

export function getActiveEvmProvider(): Eip1193Provider {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No EVM wallet provider available.');
  }
  return provider;
}

function providerLabel(provider: Eip1193Provider): string {
  if (provider.isMetaMask) return 'metamask';
  if (provider.isCoinbaseWallet) return 'coinbase';
  if (provider.isRabby) return 'rabby';
  if (provider.isTrust) return 'trust';
  if (provider.isPhantom) return 'phantom';
  if (provider.isOkxWallet) return 'okx';
  return 'injected';
}

function walletErrorMessage(error: unknown, fallback: string, provider?: Eip1193Provider): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  const message = error instanceof Error
    ? error.message
    : (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : fallback);

  if (code === 4001) return `Wallet request was rejected [provider:${provider ? providerLabel(provider) : 'unknown'}, code:4001].`;
  if (code === -32002) return `Wallet request already pending. Open your wallet extension and approve it [provider:${provider ? providerLabel(provider) : 'unknown'}, code:-32002].`;
  const codeText = code != null ? `, code:${String(code)}` : '';
  const providerText = provider ? providerLabel(provider) : 'unknown';
  return `${message} [provider:${providerText}${codeText}]`;
}

export async function connectEvmWallet(): Promise<string> {
  return connectEvmWalletWithOptions();
}

export async function connectEvmWalletWithOptions(options?: { forcePrompt?: boolean }): Promise<string> {
  if (connectInFlight) return connectInFlight;

  connectInFlight = connectEvmWalletInternal(options);
  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

async function connectEvmWalletInternal(options?: { forcePrompt?: boolean }): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No EVM wallet found. Install MetaMask or another WalletConnect-compatible wallet.');
  }

  if (!options?.forcePrompt) {
    try {
      const existing = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (existing?.[0]) {
        activeProvider = provider;
        return getAddress(existing[0]);
      }
    } catch {
      // Continue to request flow.
    }
  }

  try {
    if (options?.forcePrompt) {
      try {
        await provider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not all providers support this method.
      }
    }

    const requested = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const first = requested?.[0];
    if (!first) throw new Error('No wallet account returned.');
    activeProvider = provider;
    return getAddress(first);
  } catch (error) {
    // Last fallback: try default injected provider directly.
    const fallback = window.ethereum;
    if (fallback && fallback !== provider) {
      try {
        const requested = (await fallback.request({
          method: 'eth_requestAccounts',
        })) as string[];
        const first = requested?.[0];
        if (first) {
          activeProvider = fallback;
          return getAddress(first);
        }
      } catch {
        // Ignore and throw normalized error below.
      }
    }

    const code = typeof error === 'object' && error && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;

    if (code === -32001 || code === -32002) {
      for (let i = 0; i < 5; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
          const existing = (await provider.request({ method: 'eth_accounts' })) as string[];
          if (existing?.[0]) {
            activeProvider = provider;
            return getAddress(existing[0]);
          }
        } catch {
          // Keep polling briefly.
        }
      }
    }

    throw new Error(walletErrorMessage(error, 'Wallet connection failed.', provider));
  }
}

export async function getConnectedEvmWalletAddress(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    return accounts?.[0] ? getAddress(accounts[0]) : null;
  } catch {
    return null;
  }
}

export function disconnectEvmWalletSession(): void {
  activeProvider = null;
}

export async function signWithEoa(walletAddress: string, message: string): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No EVM wallet found.');
  }
  try {
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [message, walletAddress],
    })) as string;
    if (!signature) throw new Error('Signature request failed.');
    return signature;
  } catch (error) {
    // Some providers expect reversed argument ordering.
    const fallback = (await provider.request({
      method: 'personal_sign',
      params: [walletAddress, message],
    })) as string;
    if (!fallback) throw new Error(walletErrorMessage(error, 'Signature request failed.', provider));
    return fallback;
  }
}
