import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bancoHoras, colaboradores, registrosPonto } from "@/db/schema";
import { calcularJornadaEsperadaDoDia, calcularMinutosFechados } from "./jornada";
import type { TipoRegistro } from "./types";

// =============================================
// ATUALIZAR BANCO DE HORAS após registro de saída
// =============================================
export async function atualizarBancoHoras(
  colaboradorId: string,
  dataSaida: Date
): Promise<void> {
  try {
    const inicio = new Date(dataSaida);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);

    const registros = await db
      .select({ tipo: registrosPonto.tipo, dataHora: registrosPonto.dataHora })
      .from(registrosPonto)
      .where(
        and(
          eq(registrosPonto.colaboradorId, colaboradorId),
          gte(registrosPonto.dataHora, inicio),
          lt(registrosPonto.dataHora, fim)
        )
      )
      .orderBy(asc(registrosPonto.dataHora));

    const colab = await db
      .select({ jornadaDiaria: colaboradores.jornadaDiaria })
      .from(colaboradores)
      .where(eq(colaboradores.id, colaboradorId))
      .limit(1);

    const jornadaEsperada = colab[0]?.jornadaDiaria ?? calcularJornadaEsperadaDoDia(inicio);

    const minutos = calcularMinutosFechados(
      registros.map((r) => ({ tipo: r.tipo as TipoRegistro, dataHora: r.dataHora }))
    );
    // Saldo em minutos do ponto bruto: mantém a lógica de diferença entre
    // tempo batido e jornada esperada, sem aplicar o desconto de café de
    // fim de semana. O valor financeiro continua vindo de calcularValorFinanceiroDoDia.
    const saldo = minutos - jornadaEsperada;

    const dataStr = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(
      inicio.getDate()
    ).padStart(2, "0")}`;

    await db
      .insert(bancoHoras)
      .values({
        colaboradorId,
        data: dataStr,
        horasTrabalhadas: minutos,
        horasEsperadas: jornadaEsperada,
        saldo,
      })
      .onConflictDoUpdate({
        target: [bancoHoras.colaboradorId, bancoHoras.data],
        set: { horasTrabalhadas: minutos, horasEsperadas: jornadaEsperada, saldo },
      });
  } catch (error) {
    console.error("[BANCO-HORAS] Erro ao atualizar:", error);
  }
}
