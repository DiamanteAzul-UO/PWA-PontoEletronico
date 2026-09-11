import { NextRequest, NextResponse } from "next/server";
import { and, between, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// HISTÓRICO - GET /api/historico/registros
// Aceita ?inicio=<epoch ms>&fim=<epoch ms> (limites do fuso do cliente)
// ou ?periodo=dia|semana|mes (calculado no servidor)
// =============================================
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const agora = new Date();
    let inicio: Date;
    let fim: Date;

    const inicioParam = params.get("inicio");
    const fimParam = params.get("fim");

    if (inicioParam && fimParam && !Number.isNaN(Number(inicioParam)) && !Number.isNaN(Number(fimParam))) {
      inicio = new Date(Number(inicioParam));
      fim = new Date(Number(fimParam));
    } else {
      const periodo = params.get("periodo") ?? "dia";
      switch (periodo) {
        case "semana": {
          inicio = new Date(agora);
          inicio.setDate(agora.getDate() - agora.getDay());
          inicio.setHours(0, 0, 0, 0);
          fim = new Date(agora);
          fim.setHours(23, 59, 59, 999);
          break;
        }
        case "mes": {
          inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
          fim = new Date(agora);
          fim.setHours(23, 59, 59, 999);
          break;
        }
        default: {
          inicio = new Date(agora);
          inicio.setHours(0, 0, 0, 0);
          fim = new Date(agora);
          fim.setHours(23, 59, 59, 999);
        }
      }
    }

    const registros = await db
      .select({
        id: registrosPonto.id,
        tipo: registrosPonto.tipo,
        dataHora: registrosPonto.dataHora,
        latitude: registrosPonto.latitude,
        longitude: registrosPonto.longitude,
        endereco: registrosPonto.endereco,
        offline: registrosPonto.offline,
      })
      .from(registrosPonto)
      .where(
        and(eq(registrosPonto.colaboradorId, auth.id), between(registrosPonto.dataHora, inicio, fim))
      )
      .orderBy(desc(registrosPonto.dataHora));

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
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ erro: "Erro ao buscar histórico" }, { status: 500 });
  }
}
