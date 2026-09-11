import type { ProximoTipo, TipoRegistro } from "./types";
import {
  DESCONTO_CAFE_FDS_MIN,
  JORNADA_SEMANAL_MINUTOS,
  PONTO_CONFIG,
  VALOR_HORA_EXTRA_SEMANA as VALOR_HORA_EXTRA_SEMANA_CONFIG,
  VALOR_HORA_FERIADO as VALOR_HORA_FERIADO_CONFIG,
  VALOR_HORA_FDS as VALOR_HORA_FDS_CONFIG,
  VALOR_HORA_NORMAL as VALOR_HORA_NORMAL_CONFIG,
} from "./config-ponto";

// =============================================
// LÓGICA DE JORNADA — PROGRESSÃO E CÁLCULO DE MINUTOS
// Compartilhada entre cliente e servidor.
// =============================================

export interface RegistroMinimo {
  tipo: TipoRegistro;
  dataHora: Date;
}

export const LOCAL_TRABALHO = {
  nome: "Alameda Caiapós, 438 - Tamboré, Barueri - SP, 06460-110",
  latitude: -23.5068,
  longitude: -46.8647,
  raioMetros: 250,
};

// =============================================
// REGRAS DE PAGAMENTO
// - Segunda a sexta: TODAS as horas trabalhadas pagam R$11,00/h,
//   mesmo as que passam do horário contratado (rótulo "hora extra"
//   é só um rótulo de exibição, não muda a taxa).
// - Sábado e domingo: TODAS as horas trabalhadas pagam R$22,00/h
//   (taxa dobrada) — sem nenhum desconto extra além do almoço que
//   já é excluído naturalmente pelos horários batidos.
// =============================================
export const VALOR_HORA_NORMAL = VALOR_HORA_NORMAL_CONFIG;
export const VALOR_HORA_DOBRADA = VALOR_HORA_FDS_CONFIG;

// Jornada líquida esperada em dia de semana (07:00–17:00 menos 1h de
// almoço = 9h = 540min). Usada só para rotular o excedente como
// "hora extra" na exibição — não afeta o valor pago.
const JORNADA_ESPERADA_SEMANA_MIN = JORNADA_SEMANAL_MINUTOS;

// Sábado e domingo têm dois intervalos de café fixos (09:00–09:15 e
// 15:00–15:15) que não são batidos como registro — são descontados à
// parte do almoço, sempre 30min no total.
const DESCONTO_CAFE_FDS_MIN_LOCAL = DESCONTO_CAFE_FDS_MIN;

export function distanciaEntreCoordenadas(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (valor: number) => (valor * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estaNoLocalTrabalho(latitude: number | null, longitude: number | null): boolean {
  if (latitude == null || longitude == null) return false;
  const distancia = distanciaEntreCoordenadas(
    latitude,
    longitude,
    LOCAL_TRABALHO.latitude,
    LOCAL_TRABALHO.longitude
  );
  return distancia <= LOCAL_TRABALHO.raioMetros;
}

export function ehFeriado(data: Date): boolean {
  const mes = data.getMonth() + 1;
  const dia = data.getDate();

  if (PONTO_CONFIG.feriadosFixos.some(([m, d]) => mes === m && dia === d)) return true;

  const ano = data.getFullYear();

  const pascoa = new Date(ano, 2, 22);
  while (pascoa.getDay() !== 0) pascoa.setDate(pascoa.getDate() + 1);
  const sextaPaixao = new Date(pascoa.getTime() - 2 * 24 * 60 * 60 * 1000);
  const corpusChristi = new Date(pascoa.getTime() + 60 * 24 * 60 * 60 * 1000);
  const carnaval = new Date(pascoa.getTime() - 48 * 24 * 60 * 60 * 1000);

  const feriadosMoveis = [
    [carnaval.getMonth() + 1, carnaval.getDate()],
    [sextaPaixao.getMonth() + 1, sextaPaixao.getDate()],
    [corpusChristi.getMonth() + 1, corpusChristi.getDate()],
    [pascoa.getMonth() + 1, pascoa.getDate()],
  ];

  return feriadosMoveis.some(([m, d]) => mes === m && dia === d);
}

/**
 * Jornada líquida esperada do dia, em minutos, usada só para ROTULAR
 * o excedente como "hora extra" na exibição. Não influencia o valor
 * pago — isso é feito direto em calcularValorFinanceiroDoDia.
 */
export function calcularJornadaEsperadaDoDia(data: Date): number {
  const dia = data.getDay();

  if (dia === 6 || dia === 0) return 0;
  return JORNADA_ESPERADA_SEMANA_MIN;
}

/**
 * Minutos a rotular como "hora extra" na exibição (não afeta o valor pago).
 * Seg-sex: excedente além da jornada esperada (9h líquidas).
 * Sáb/dom: todas as horas líquidas contam como "extra" (rótulo).
 */
export function calcularMinutosExtrasPorRegistros(
  data: Date,
  registros: RegistroMinimo[]
): number {
  const dia = data.getDay();
  const minutosTrabalhados = calcularMinutosFechados(registros);

  if (dia === 6 || dia === 0) {
    return Math.max(0, minutosTrabalhados - DESCONTO_CAFE_FDS_MIN_LOCAL);
  }

  const jornadaBase = calcularJornadaEsperadaDoDia(data);
  return Math.max(0, minutosTrabalhados - jornadaBase);
}

export function calcularHorasExtrasEmMinutos(
  data: Date,
  minutosTrabalhados: number,
  jornadaEsperada = JORNADA_ESPERADA_SEMANA_MIN
): number {
  const dia = data.getDay();

  if (dia === 6 || dia === 0) {
    return Math.max(0, minutosTrabalhados - DESCONTO_CAFE_FDS_MIN_LOCAL);
  }

  const jornadaBase = jornadaEsperada || calcularJornadaEsperadaDoDia(data);
  return Math.max(0, minutosTrabalhados - jornadaBase);
}

/**
 * Valor financeiro do dia.
 * - Seg-sex: todas as horas líquidas × R$11 (sem distinção de "extra").
 * - Sáb/dom: todas as horas líquidas × R$22.
 * - Feriado: tratado como fim de semana (R$22).
 */
export function calcularValorFinanceiroDoDia(
  data: Date,
  minutosTrabalhados: number,
  jornadaEsperada = JORNADA_ESPERADA_SEMANA_MIN
): number {
  const dia = data.getDay();

  if (dia === 6 || dia === 0) {
    // Sábado e domingo: desconta os 30min de café (09:00–09:15 e
    // 15:00–15:15), separado do almoço, que já foi excluído pelos
    // horários batidos.
    const minutosLiquidos = Math.max(0, minutosTrabalhados - DESCONTO_CAFE_FDS_MIN_LOCAL);
    return (minutosLiquidos / 60) * VALOR_HORA_FDS_CONFIG;
  }

  if (ehFeriado(data)) {
    const minutosLiquidos = Math.max(0, minutosTrabalhados);
    return (minutosLiquidos / 60) * VALOR_HORA_FERIADO_CONFIG;
  }

  const minutosLiquidos = Math.max(0, minutosTrabalhados);
  const jornadaBase = jornadaEsperada || calcularJornadaEsperadaDoDia(data);
  const minutosNormais = Math.min(minutosLiquidos, jornadaBase);
  const minutosExtras = Math.max(0, minutosLiquidos - jornadaBase);

  return (minutosNormais / 60) * VALOR_HORA_NORMAL + (minutosExtras / 60) * VALOR_HORA_EXTRA_SEMANA_CONFIG;
}

export function calcularProximoTipo(tipos: TipoRegistro[]): ProximoTipo {
  if (tipos.includes("saida")) return "completo";
  if (tipos.includes("volta_almoco")) return "saida";
  if (tipos.includes("saida_almoco")) return "volta_almoco";
  if (tipos.includes("entrada")) return "saida_almoco";
  return "entrada";
}

/**
 * Calcula os minutos trabalhados no dia.
 * Usa `agora` como limite enquanto a jornada não está completa.
 */
export function calcularMinutosTrabalhados(
  registros: RegistroMinimo[],
  agora: Date
): number {
  const entrada = registros.find((r) => r.tipo === "entrada");
  const saidaAlmoco = registros.find((r) => r.tipo === "saida_almoco");
  const voltaAlmoco = registros.find((r) => r.tipo === "volta_almoco");
  const saida = registros.find((r) => r.tipo === "saida");

  let minutos = 0;

  if (entrada) {
    const fimManha = saidaAlmoco ? saidaAlmoco.dataHora : agora;
    minutos += (fimManha.getTime() - entrada.dataHora.getTime()) / 60000;

    if (voltaAlmoco) {
      const fimTarde = saida ? saida.dataHora : agora;
      minutos += (fimTarde.getTime() - voltaAlmoco.dataHora.getTime()) / 60000;
    }
  }

  return Math.max(0, Math.round(minutos));
}

/**
 * Minutos trabalhados já fechados (jornada completa) — usado em banco de horas.
 * O almoço já é excluído naturalmente por não somar o intervalo entre
 * saida_almoco e volta_almoco. NÃO aplica nenhum desconto adicional:
 * o desconto extra de 30min que existia aqui para sábado duplicava o
 * desconto do almoço (que já tinha sido removido pelos horários batidos)
 * e por isso inflava indevidamente o saldo pago.
 */
export function calcularMinutosFechados(registros: RegistroMinimo[]): number {
  const entrada = registros.find((r) => r.tipo === "entrada");
  const saidaAlmoco = registros.find((r) => r.tipo === "saida_almoco");
  const voltaAlmoco = registros.find((r) => r.tipo === "volta_almoco");
  const saida = registros.find((r) => r.tipo === "saida");

  let minutos = 0;
  if (entrada && saidaAlmoco) {
    minutos += (saidaAlmoco.dataHora.getTime() - entrada.dataHora.getTime()) / 60000;
  }
  if (voltaAlmoco && saida) {
    minutos += (saida.dataHora.getTime() - voltaAlmoco.dataHora.getTime()) / 60000;
  }

  return Math.max(0, Math.round(minutos));
}

export const STATUS_TEXTO: Record<ProximoTipo, string> = {
  entrada: "Aguardando entrada",
  saida_almoco: "Trabalhando",
  volta_almoco: "Intervalo de almoço",
  saida: "Trabalhando",
  completo: "Jornada completa",
};

export const TIPO_LABEL: Record<TipoRegistro, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída Almoço",
  volta_almoco: "Volta Almoço",
  saida: "Saída",
};