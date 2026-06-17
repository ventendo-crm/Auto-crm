import { Prisma } from "@prisma/client";

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, serializeValue(val)]),
    );
  }

  return value;
}

export function serialize<T>(data: T): T {
  return serializeValue(data) as T;
}
