import { hash, verify, Algorithm } from "@node-rs/argon2";

const argonOpts = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, argonOpts);
}

export async function verifyPassword(passwordHash: string | null | undefined, plain: string): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}
