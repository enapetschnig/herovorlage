type Argon2Module = typeof import("@node-rs/argon2");
let cached: Argon2Module | null = null;

async function getArgon2(): Promise<Argon2Module> {
  if (!cached) {
    cached = await import(/* webpackIgnore: true */ "@node-rs/argon2");
  }
  return cached;
}

export async function hashPassword(plain: string): Promise<string> {
  const { hash, Algorithm } = await getArgon2();
  return hash(plain, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string | null | undefined, plain: string): Promise<boolean> {
  if (!hash) return false;
  try {
    const argon = await getArgon2();
    return await argon.verify(hash, plain);
  } catch {
    return false;
  }
}
