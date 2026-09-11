import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { resolvePerfil } from "@/lib/perfil";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET deve ser definido no ambiente de produção.");
}

export type PerfilColaborador = "colaborador" | "rh" | "admin";

export interface JwtPayload {
  id: string;
  email: string;
  empresaId: string | null;
  perfil?: PerfilColaborador;
}

export function normalizePerfil(perfil?: string | null, fallback?: string | null): PerfilColaborador {
  return resolvePerfil(perfil, fallback);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function getAuth(req: NextRequest): JwtPayload | null {
  const header = req.headers.get("authorization");
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme) || !token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
