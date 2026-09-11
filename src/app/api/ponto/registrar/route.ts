import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { atualizarBancoHoras } from "@/lib/banco-horas";
import type { TipoRegistro } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_VALIDOS: TipoRegistro[] = ["entrada", "saida_almoco", "volta_almoco", "saida"];

// =============================================
// REGISTRAR PONTO - POST /api/ponto/registrar
// =============================================
export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, latitude, longitude, endereco, dispositivo, offline, data_hora_offline } = body;

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ erro: "Tipo de registro inválido" }, { status: 400 });
    }

    // Verificar duplicidade (mesmo tipo nos últimos 2 minutos)
    const doisMinAtras = new Date(Date.now() - 2 * 60 * 1000);
    const dup = await db
      .select({ id: registrosPonto.id })
      .from(registrosPonto)
      .where(
        and(
          eq(registrosPonto.colaboradorId, auth.id),
          eq(registrosPonto.tipo, tipo),
          gt(registrosPonto.dataHora, doisMinAtras)
        )
      )
      .limit(1);

    if (dup.length > 0) {
      return NextResponse.json(
        { erro: "Registro duplicado. Aguarde 2 minutos." },
        { status: 409 }
      );
    }

    const dataHora = offline && data_hora_offline ? new Date(data_hora_offline) : new Date();

    // Hash de integridade
    const hashRegistro = createHash("sha256")
      .update(`${auth.id}${tipo}${dataHora.toISOString()}${Date.now()}`)
      .digest("hex");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    const resultado = await db
      .insert(registrosPonto)
      .values({
        colaboradorId: auth.id,
        tipo,
        dataHora,
        latitude: latitude != null ? String(latitude) : null,
        longitude: longitude != null ? String(longitude) : null,
        endereco: endereco ?? null,
        dispositivo: dispositivo ?? req.headers.get("user-agent"),
        ip,
        offline: Boolean(offline),
        sincronizado: true,
        hashRegistro,
      })
      .returning({
        id: registrosPonto.id,
        tipo: registrosPonto.tipo,
        dataHora: registrosPonto.dataHora,
        latitude: registrosPonto.latitude,
        longitude: registrosPonto.longitude,
      });

    if (tipo === "saida") {
      await atualizarBancoHoras(auth.id, dataHora);
    }

    return NextResponse.json(
      { mensagem: "Ponto registrado com sucesso", registro: resultado[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao registrar ponto:", error);
    return NextResponse.json({ erro: "Erro ao registrar ponto" }, { status: 500 });
  }
}
