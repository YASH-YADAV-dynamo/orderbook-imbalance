'use client';

import { useCallback, useState } from 'react';
import { activateAgent, createAgentChallenge, registerAgent } from '@/lib/trading/executionClient';
import { signWithEoa } from '@/lib/trading/wallet';
import { activateHotstuffAgentDirectWithKey } from '@/lib/trading/hotstuff/activateAgentDirect';
import { ensureHotstuffAgentPrivateKey } from '@/lib/trading/hotstuff/agentStorage';
import { buildHotstuffAgentActivationPayload } from '@/lib/trading/hotstuff/buildAgentActivationPayload';
import type { ExecutionExchange } from '@/types/trading';

export function useAgentRegistration(exchange: ExecutionExchange, walletAddress: string | null) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (options?: { agentName?: string; agentPrivateKey?: `0x${string}` }): Promise<string> => {
    if (!walletAddress) throw new Error('Connect wallet first.');
    setRunning(true);
    try {
      if (exchange === 'hotstuff') {
        const built = await buildHotstuffAgentActivationPayload(
          walletAddress,
          options?.agentName ?? 'browser-agent',
          options?.agentPrivateKey,
        );
        try {
          const activated = await activateAgent({
            exchange,
            walletAddress,
            apiAgentId: built.agentAddress,
            signedAgentPayload: built.signedPayload,
          });
          setAgentId(activated.agentId);
          return activated.agentId;
        } catch (error) {
          const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          if (msg.includes('invalid signature')) {
            const directAgent = await activateHotstuffAgentDirectWithKey(
              walletAddress,
              options?.agentPrivateKey ?? ensureHotstuffAgentPrivateKey(walletAddress),
            );
            setAgentId(directAgent);
            return directAgent;
          }
          if (msg.includes('exists') || msg.includes('already')) {
            setAgentId(built.agentAddress);
            return built.agentAddress;
          }
          throw error;
        }
      }

      const challenge = await createAgentChallenge({ exchange, walletAddress });
      const signature = await signWithEoa(walletAddress, challenge.message);
      const registered = await registerAgent({
        exchange,
        walletAddress,
        challengeId: challenge.challengeId,
        signature,
      });
      setAgentId(registered.agentId);
      return registered.agentId;
    } finally {
      setRunning(false);
    }
  }, [exchange, walletAddress]);

  return { agentId, setAgentId, running, run };
}
