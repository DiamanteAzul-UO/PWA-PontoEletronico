export const PONTO_CONFIG = {
  valorHoraNormal: 11,
  valorHoraExtraSemana: 11,
  valorHoraFds: 22,
  valorHoraFeriado: 22,
  jornadaSemanalMinutos: 8 * 60,
  descontoCafeFdsMinutos: 30,
  horarioSemana: {
    inicio: "07:00",
    fim: "17:00",
  },  
  horarioSexta: {
    inicio: "07:00",
    fim: "16:00",
  },
  horarioSabado: {
    inicio: "07:00",
    fim: "16:00",
  },
  horarioDomingo: {
    inicio: "07:00",
    fim: "15:00",
  },
  feriadosFixos: [
    [1, 1],
    [4, 21],
    [5, 1],
    [9, 7],
    [10, 12],
    [11, 2],
    [11, 15],
    [12, 25],
  ] as const,
} as const;

export const VALOR_HORA_NORMAL = PONTO_CONFIG.valorHoraNormal;
export const VALOR_HORA_EXTRA_SEMANA = PONTO_CONFIG.valorHoraExtraSemana;
export const VALOR_HORA_FDS = PONTO_CONFIG.valorHoraFds;
export const VALOR_HORA_FERIADO = PONTO_CONFIG.valorHoraFeriado;
export const JORNADA_SEMANAL_MINUTOS = PONTO_CONFIG.jornadaSemanalMinutos;
export const DESCONTO_CAFE_FDS_MIN = PONTO_CONFIG.descontoCafeFdsMinutos;
