import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(passwordHash: string | null | undefined, plain: string): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    return await bcrypt.compare(plain, passwordHash);
  } catch {
    return false;
  }
}
