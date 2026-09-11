import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bancoHoras } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { formatarMinutos } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// SALDO DO BANCO DE HORAS - GET /api/historico/saldo
// =============================================
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const resultado = await db
      .select({ saldoTotal: sql<number>`coalesce(sum(${bancoHoras.saldo}), 0)::int` })
      .from(bancoHoras)
      .where(eq(bancoHoras.colaboradorId, auth.id));

    const saldo = resultado[0]?.saldoTotal ?? 0;

    return NextResponse.json({
      saldo_minutos: saldo,
      saldo_formatado: formatarMinutos(saldo, true),
      tipo: saldo >= 0 ? "positivo" : "negativo",
    });
  } catch (error) {
    console.error("Erro ao buscar saldo:", error);
    return NextResponse.json({ erro: "Erro ao buscar saldo" }, { status: 500 });
  }
}
