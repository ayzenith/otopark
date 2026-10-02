import { PrismaClient } from "@prisma/client";

/**
 * Prisma istemcisi - tekil ornek (singleton).
 * Gelistirme ortaminda hot-reload her seferinde yeni baglanti havuzu
 * olusturmasin diye global uzerinde saklanir.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
