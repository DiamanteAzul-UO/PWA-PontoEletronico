import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { atualizarBancoHoras } from "@/lib/banco-horas";
import type { TipoRegistro } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_VALIDOS: TipoRegistro[] = ["entrada", "saida_almoco", "volta_almoco", "saida"];

// =============================================
// SINCRONIZAR REGISTROS OFFLINE - POST /api/ponto/sincronizar
// =============================================
export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const { registros } = await req.json();
    if (!Array.isArray(registros)) {
      return NextResponse.json({ erro: "Formato inválido" }, { status: 400 });
    }

    const resultados: {
      local_id: number | string;
      sincronizado: boolean;
      server_id?: string;
      erro?: string;
    }[] = [];

    for (const reg of registros) {
      try {
        if (!TIPOS_VALIDOS.includes(reg.tipo) || !reg.data_hora) {
          resultados.push({ local_id: reg.id, sincronizado: false, erro: "dados inválidos" });
          continue;
        }

        const dataHora = new Date(reg.data_hora);
        const hashRegistro = createHash("sha256")
          .update(`${auth.id}${reg.tipo}${dataHora.toISOString()}${Date.now()}${reg.id}`)
          .digest("hex");

        const inserido = await db
          .insert(registrosPonto)
          .values({
            colaboradorId: auth.id,
            tipo: reg.tipo,
            dataHora,
            latitude: reg.latitude != null ? String(reg.latitude) : null,
            longitude: reg.longitude != null ? String(reg.longitude) : null,
            endereco: reg.endereco ?? null,
            dispositivo: reg.dispositivo ?? null,
            offline: true,
            sincronizado: true,
            hashRegistro,
          })
          .returning({ id: registrosPonto.id });

        if (reg.tipo === "saida") {
          await atualizarBancoHoras(auth.id, dataHora);
        }

        resultados.push({
          local_id: reg.id,
          sincronizado: true,
          server_id: inserido[0]?.id,
        });
      } catch (err) {
        resultados.push({
          local_id: reg.id,
          sincronizado: false,
          erro: err instanceof Error ? err.message : "erro desconhecido",
        });
      }
    }

    return NextResponse.json({ mensagem: "Sincronização concluída", resultados });
  } catch (error) {
    console.error("Erro na sincronização:", error);
    return NextResponse.json({ erro: "Erro na sincronização" }, { status: 500 });
  }
}
