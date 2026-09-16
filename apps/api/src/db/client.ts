import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

/** One client per process. Fastify closes it in an onClose hook. */
export function prisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

export type Db = PrismaClient;
