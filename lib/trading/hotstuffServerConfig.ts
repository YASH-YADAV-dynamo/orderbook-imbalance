import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const ConfigSchema = z.object({
  hotstuffHttpUrl: z.string().url(),
  hotstuffWsUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  brokerAddress: z.preprocess(emptyToUndefined, z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()),
  maxFeeRate: z.preprocess(emptyToUndefined, z.coerce.number().positive().optional()),
  agentValidDays: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(30)),
});

export type HotstuffServerConfig = z.infer<typeof ConfigSchema>;

let cached: HotstuffServerConfig | null = null;

export function getHotstuffServerConfig(): HotstuffServerConfig {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse({
    hotstuffHttpUrl: process.env.NEXT_PUBLIC_HOTSTUFF_HTTP,
    hotstuffWsUrl: process.env.NEXT_PUBLIC_HOTSTUFF_WS,
    brokerAddress: process.env.NEXT_PUBLIC_BROKER_ADDRESS,
    maxFeeRate: process.env.NEXT_PUBLIC_MAX_FEE_RATE,
    agentValidDays: process.env.NEXT_PUBLIC_AGENT_VALID_DAYS,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`HotStuff env misconfigured: ${first?.path.join('.') ?? 'unknown'}`);
  }
  cached = parsed.data;
  return cached;
}
