interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function hasEvmWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectEvmWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No EVM wallet found. Install MetaMask or another WalletConnect-compatible wallet.');
  }
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const first = accounts[0];
  if (!first) throw new Error('No wallet account returned.');
  return first;
}

export async function signWithEoa(walletAddress: string, message: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No EVM wallet found.');
  }
  const signature = (await window.ethereum.request({
    method: 'personal_sign',
    params: [message, walletAddress],
  })) as string;
  if (!signature) throw new Error('Signature request failed.');
  return signature;
}
