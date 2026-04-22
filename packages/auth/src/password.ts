import { hash as argonHash, verify as argonVerify, Algorithm } from "@node-rs/argon2";

const argonOpts = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, argonOpts);
}

export async function verifyPassword(hash: string | null | undefined, plain: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}
