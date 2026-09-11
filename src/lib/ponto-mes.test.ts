import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularHorasExtrasEmMinutos,
  calcularJornadaEsperadaDoDia,
  calcularMinutosExtrasPorRegistros,
  calcularValorFinanceiroDoDia,
} from "./jornada";
import { PONTO_CONFIG } from "./config-ponto";
import { detectarDiasComErro, tipoParaTexto, type RegistroDiaResumo } from "./ponto-mes";

test("detectarDiasComErro identifica faltas e registros incompletos", () => {
  const registros: RegistroDiaResumo[] = [
    { data: "2026-09-01", registros: [{ tipo: "entrada", data_hora: "2026-09-01T08:00:00.000Z" }] },
    {
      data: "2026-09-02",
      registros: [
        { tipo: "entrada", data_hora: "2026-09-02T08:00:00.000Z" },
        { tipo: "saida_almoco", data_hora: "2026-09-02T12:00:00.000Z" },
      ],
    },
    { data: "2026-09-03", registros: [] },
  ];

  const erros = detectarDiasComErro(registros);
  assert.deepEqual(erros, ["2026-09-01", "2026-09-02", "2026-09-03"]);
});

test("tipoParaTexto retorna label em texto", () => {
  assert.equal(tipoParaTexto("entrada"), "Entrada");
  assert.equal(tipoParaTexto("saida"), "Saída");
});

test("calcularValorFinanceiroDoDia usa a regra por dia da semana", () => {
  const data = new Date("2026-09-04T12:00:00");
  const minutosTrabalhados = 11 * 60;
  const valor = calcularValorFinanceiroDoDia(data, minutosTrabalhados, calcularJornadaEsperadaDoDia(data));

  assert.equal(Math.round(valor * 100) / 100, 121);
  assert.equal(calcularHorasExtrasEmMinutos(data, minutosTrabalhados, calcularJornadaEsperadaDoDia(data)), 3 * 60);
});

test("faixa de semana e fim de semana respeita regra geral", () => {
  const quinta = new Date("2026-09-03T12:00:00");
  const sexta = new Date("2026-09-04T12:00:00");
  const sabado = new Date("2026-09-05T12:00:00");
  const domingo = new Date("2026-09-06T12:00:00");

  assert.equal(calcularJornadaEsperadaDoDia(quinta), 8 * 60);
  assert.equal(calcularJornadaEsperadaDoDia(sexta), 8 * 60);
  assert.equal(calcularJornadaEsperadaDoDia(sabado), 0);
  assert.equal(calcularJornadaEsperadaDoDia(domingo), 0);

  assert.equal(calcularValorFinanceiroDoDia(sabado, 9 * 60, 0), (9 * 60 - 30) * 22 / 60);
  assert.equal(calcularValorFinanceiroDoDia(domingo, 7 * 60, 0), (7 * 60 - 30) * 22 / 60);
});

test("hora extra considera o horário real do ponto e não só o total de minutos", () => {
  const data = new Date("2026-09-04T12:00:00");
  const registros = [
    { tipo: "entrada", dataHora: new Date("2026-09-04T07:00:00") },
    { tipo: "saida_almoco", dataHora: new Date("2026-09-04T11:30:00") },
    { tipo: "volta_almoco", dataHora: new Date("2026-09-04T12:30:00") },
    { tipo: "saida", dataHora: new Date("2026-09-04T18:00:00") },
  ] as const;

  assert.equal(calcularMinutosExtrasPorRegistros(data, registros), 2 * 60);
  assert.equal(calcularHorasExtrasEmMinutos(data, 10 * 60, 480), 2 * 60);
});

test("sábado desconta o café automaticamente antes de pagar o dia", () => {
  const sabado = new Date("2026-09-05T12:00:00");
  const registros = [
    { tipo: "entrada", dataHora: new Date("2026-09-05T07:00:00") },
    { tipo: "saida_almoco", dataHora: new Date("2026-09-05T11:30:00") },
    { tipo: "volta_almoco", dataHora: new Date("2026-09-05T12:30:00") },
    { tipo: "saida", dataHora: new Date("2026-09-05T16:00:00") },
  ] as const;

  assert.equal(calcularMinutosExtrasPorRegistros(sabado, registros), 8 * 60 - 30);
  assert.equal(calcularValorFinanceiroDoDia(sabado, 8 * 60, 0), (8 * 60 - 30) * 22 / 60);
});

test("config interna centraliza os valores de hora e feriados", () => {
  assert.equal(PONTO_CONFIG.valorHoraNormal, 11);
  assert.equal(PONTO_CONFIG.valorHoraExtraSemana, 11);
  assert.equal(PONTO_CONFIG.valorHoraFds, 22);
  assert.equal(PONTO_CONFIG.valorHoraFeriado, 22);
  assert.equal(PONTO_CONFIG.jornadaSemanalMinutos, 8 * 60);
  assert.equal(PONTO_CONFIG.descontoCafeFdsMinutos, 30);
});

test("auth-server não trava o build em produção quando JWT_SECRET ainda não foi injetado", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.JWT_SECRET;

  try {
    const mod = await import(`./auth-server?build-check=${Date.now()}`);
    assert.ok(mod.signToken);
    assert.ok(mod.getAuth);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
