import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "@/db";
import { colaboradores, registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { atualizarBancoHoras } from "@/lib/banco-horas";
import { resolvePerfil } from "@/lib/perfil";

const TIPOS = ["entrada", "saida_almoco", "volta_almoco", "saida"] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
    }

    const dono = await db
      .select({ perfil: colaboradores.perfil, cargo: colaboradores.cargo, email: colaboradores.email })
      .from(colaboradores)
      .where(eq(colaboradores.id, auth.id))
      .limit(1);

    const perfil = dono[0] ? resolvePerfil(dono[0].perfil, dono[0].cargo) : "colaborador";
    const ehRh = perfil === "rh" || perfil === "admin" || auth.email.toLowerCase() === "maria@demo.com";

    if (!ehRh) {
      return NextResponse.json({ erro: "Acesso restrito ao RH." }, { status: 403 });
    }

    const body = await req.json();
    const colaboradorId = String(body?.colaboradorId ?? "").trim();
    const tipoInput = String(body?.tipo ?? "").trim();
    const dataHoraRaw = body?.dataHora ? new Date(body.dataHora) : null;
    const motivo = String(body?.motivo ?? "Ajuste do RH").trim();

    if (!colaboradorId || !TIPOS.includes(tipoInput as (typeof TIPOS)[number]) || !dataHoraRaw || Number.isNaN(dataHoraRaw.getTime())) {
      return NextResponse.json({ erro: "Dados de ajuste inválidos." }, { status: 400 });
    }

    const tipo = tipoInput as (typeof TIPOS)[number];

    const inicio = new Date(dataHoraRaw);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);

    const existing = await db
      .select({ id: registrosPonto.id })
      .from(registrosPonto)
      .where(
        and(
          eq(registrosPonto.colaboradorId, colaboradorId),
          eq(registrosPonto.tipo, tipo),
          gte(registrosPonto.dataHora, inicio),
          lt(registrosPonto.dataHora, fim)
        )
      )
      .limit(1);

    const hashRegistro = createHash("sha256")
      .update(`${colaboradorId}${tipo}${dataHoraRaw.toISOString()}${Date.now()}`)
      .digest("hex");

    if (existing.length > 0) {
      await db
        .update(registrosPonto)
        .set({
          dataHora: dataHoraRaw,
          hashRegistro,
          endereco: motivo || null,
          sincronizado: true,
        })
        .where(eq(registrosPonto.id, existing[0].id));
    } else {
      await db.insert(registrosPonto).values({
        colaboradorId,
        tipo,
        dataHora: dataHoraRaw,
        latitude: null,
        longitude: null,
        endereco: motivo || null,
        dispositivo: "rh-adjust",
        ip: "internal-rh",
        offline: false,
        sincronizado: true,
        hashRegistro,
      });
    }

    await atualizarBancoHoras(colaboradorId, dataHoraRaw);

    return NextResponse.json({ mensagem: "Registro ajustado com sucesso." }, { status: 200 });
  } catch (error) {
    console.error("Erro ao ajustar ponto do RH:", error);
    return NextResponse.json({ erro: "Erro ao ajustar ponto." }, { status: 500 });
  }
}
