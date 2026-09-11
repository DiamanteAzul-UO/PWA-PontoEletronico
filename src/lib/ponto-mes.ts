export type TipoRegistroPonto = "entrada" | "saida_almoco" | "volta_almoco" | "saida";

export interface RegistroDiaResumo {
  data: string;
  registros: Array<{ tipo: TipoRegistroPonto; data_hora: string }>;
  nome?: string;
  colaboradorId?: string;
  email?: string;
  status?: string;
}

export interface ResumoMensal {
  data: string;
  nome: string;
  colaboradorId: string;
  totalRegistros: number;
  diasComErro: string[];
  relatorio: string[];
}

export function tipoParaTexto(tipo: TipoRegistroPonto): string {
  const mapa: Record<TipoRegistroPonto, string> = {
    entrada: "Entrada",
    saida_almoco: "Saída Almoço",
    volta_almoco: "Volta Almoço",
    saida: "Saída",
  };

  return mapa[tipo] ?? tipo;
}

export function detectarDiasComErro(registrosPorDia: RegistroDiaResumo[]): string[] {
  const diasComErro = new Set<string>();

  for (const dia of registrosPorDia) {
    const tipos = dia.registros.map((r) => r.tipo);

    const temEntrada = tipos.includes("entrada");
    const temSaidaAlmoco = tipos.includes("saida_almoco");
    const temVoltaAlmoco = tipos.includes("volta_almoco");
    const temSaida = tipos.includes("saida");

    const incompleto = !temEntrada || !temSaida || (temEntrada && !temSaidaAlmoco && !temSaida);

    const ordemCorreta =
      tipos.indexOf("entrada") <= tipos.indexOf("saida_almoco") &&
      tipos.indexOf("saida_almoco") <= tipos.indexOf("volta_almoco") &&
      tipos.indexOf("volta_almoco") <= tipos.indexOf("saida");

    if (incompleto || !ordemCorreta) {
      diasComErro.add(dia.data);
    }
  }

  return Array.from(diasComErro).sort();
}

export function gerarRelatorioMensal(resumos: RegistroDiaResumo[]): ResumoMensal[] {
  return resumos.map((item) => ({
    data: item.data,
    nome: item.nome ?? "Colaborador",
    colaboradorId: item.colaboradorId ?? "",
    totalRegistros: item.registros.length,
    diasComErro: detectarDiasComErro([item]),
    relatorio: item.registros.map((r) => `${r.data_hora} - ${tipoParaTexto(r.tipo)}`),
  }));
}
