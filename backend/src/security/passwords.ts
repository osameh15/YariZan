import { hash, verify, argon2id } from "argon2";
import { requireCondition } from "../common/errors";
import { Injectable } from "@nestjs/common";
let active = 0;
async function bounded<T>(work: () => Promise<T>) {
  requireCondition(active < 4, "RATE_LIMITED", 429);
  active++;
  try {
    return await work();
  } finally {
    active--;
  }
}
export const hashPassword = (value: string) =>
  bounded(() =>
    hash(value, {
      type: argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    }),
  );
export const verifyPassword = (encoded: string, value: string) =>
  bounded(() => verify(encoded, value));

@Injectable()
export class PasswordHashing {
  hash(value: string) {
    return hashPassword(value);
  }
}
