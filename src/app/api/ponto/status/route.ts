import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { calcularMinutosTrabalhados, calcularProximoTipo } from "@/lib/jornada";
import type { TipoRegistro } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// STATUS DO DIA - GET /api/ponto/status
// ?inicio=<epoch ms> permite o cliente enviar sua meia-noite local
// =============================================
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const inicioParam = req.nextUrl.searchParams.get("inicio");
    let inicio: Date;
    if (inicioParam && !Number.isNaN(Number(inicioParam))) {
      inicio = new Date(Number(inicioParam));
    } else {
      inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
    }
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

    const registros = await db
      .select()
      .from(registrosPonto)
      .where(
        and(
          eq(registrosPonto.colaboradorId, auth.id),
          gte(registrosPonto.dataHora, inicio),
          lt(registrosPonto.dataHora, fim)
        )
      )
      .orderBy(asc(registrosPonto.dataHora));

    const tipos = registros.map((r) => r.tipo as TipoRegistro);
    const proximoTipo = calcularProximoTipo(tipos);
    const minutosTrabalhados = calcularMinutosTrabalhados(
      registros.map((r) => ({ tipo: r.tipo as TipoRegistro, dataHora: r.dataHora })),
      new Date()
    );

    return NextResponse.json({
      registros: registros.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        data_hora: r.dataHora.toISOString(),
        latitude: r.latitude,
        longitude: r.longitude,
        endereco: r.endereco,
        offline: r.offline,
      })),
      proximoTipo,
      minutosTrabalhados,
      jornadaCompleta: proximoTipo === "completo",
    });
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json({ erro: "Erro ao buscar status" }, { status: 500 });
  }
}
