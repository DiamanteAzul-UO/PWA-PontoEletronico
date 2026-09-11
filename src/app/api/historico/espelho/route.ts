import { NextRequest, NextResponse } from "next/server";
import { and, asc, between, eq } from "drizzle-orm";
import { db } from "@/db";
import { bancoHoras, colaboradores, registrosPonto } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { formatarMinutos } from "@/lib/format";
import { calcularJornadaEsperadaDoDia, calcularMinutosFechados, calcularValorFinanceiroDoDia } from "@/lib/jornada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// ESPELHO DE PONTO - GET /api/historico/espelho?mes=&ano=
// =============================================
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const now = new Date();
    const mesRef = Math.min(12, Math.max(1, parseInt(params.get("mes") ?? "", 10) || now.getMonth() + 1));
    const anoRef = parseInt(params.get("ano") ?? "", 10) || now.getFullYear();

    const mm = String(mesRef).padStart(2, "0");
    const ultimoDia = new Date(anoRef, mesRef, 0).getDate();
    const dataInicioStr = `${anoRef}-${mm}-01`;
    const dataFimStr = `${anoRef}-${mm}-${String(ultimoDia).padStart(2, "0")}`;

    const inicioTs = new Date(anoRef, mesRef - 1, 1, 0, 0, 0, 0);
    const fimTs = new Date(anoRef, mesRef, 0, 23, 59, 59, 999);

    const colaboradorBase = await db
      .select({ jornadaDiaria: colaboradores.jornadaDiaria })
      .from(colaboradores)
      .where(eq(colaboradores.id, auth.id))
      .limit(1);

    const jornadaBase = colaboradorBase[0]?.jornadaDiaria ?? 540;

    const banco = await db
      .select()
      .from(bancoHoras)
      .where(and(eq(bancoHoras.colaboradorId, auth.id), between(bancoHoras.data, dataInicioStr, dataFimStr)))
      .orderBy(asc(bancoHoras.data));

    const registros = await db
      .select({ tipo: registrosPonto.tipo, dataHora: registrosPonto.dataHora })
      .from(registrosPonto)
      .where(and(eq(registrosPonto.colaboradorId, auth.id), between(registrosPonto.dataHora, inicioTs, fimTs)))
      .orderBy(asc(registrosPonto.dataHora));

    let totalTrabalhado = 0;
    let totalEsperado = 0;
    let totalSaldo = 0;

    const porDia = new Map<string, { tipo: string; data_hora: string }[]>();
    for (const reg of registros) {
      const data = new Date(reg.dataHora);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
      if (!porDia.has(chave)) porDia.set(chave, []);
      porDia.get(chave)!.push({ tipo: reg.tipo, data_hora: reg.dataHora.toISOString() });
    }

    for (const dia of banco) {
      const data = new Date(`${dia.data}T12:00:00`);
      const registrosDia = porDia.get(dia.data) ?? [];
      const horasTrabalhadas = registrosDia.length
        ? calcularMinutosFechados(registrosDia.map((r) => ({ tipo: r.tipo as any, dataHora: new Date(r.data_hora) })))
        : dia.horasTrabalhadas ?? 0;
      const horasEsperadas = calcularJornadaEsperadaDoDia(data) || jornadaBase;
      totalTrabalhado += horasTrabalhadas;
      totalEsperado += horasEsperadas;
      totalSaldo += calcularValorFinanceiroDoDia(data, horasTrabalhadas, horasEsperadas);
    }

    return NextResponse.json({
      mes: mesRef,
      ano: anoRef,
      registros: registros.map((r) => ({ tipo: r.tipo, data_hora: r.dataHora.toISOString() })),
      bancoHoras: banco.map((b) => ({
        data: b.data,
        horas_trabalhadas: b.horasTrabalhadas ?? 0,
        horas_esperadas: b.horasEsperadas ?? 0,
        saldo: b.saldo ?? 0,
      })),
      totais: {
        trabalhado: totalTrabalhado,
        esperado: totalEsperado,
        saldo: totalSaldo,
        trabalhadoFormatado: formatarMinutos(totalTrabalhado),
        esperadoFormatado: formatarMinutos(totalEsperado),
        saldoFormatado: formatarMinutos(totalSaldo, true),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar espelho:", error);
    return NextResponse.json({ erro: "Erro ao gerar espelho de ponto" }, { status: 500 });
  }
}
