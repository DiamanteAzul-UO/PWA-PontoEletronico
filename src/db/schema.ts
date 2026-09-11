import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  numeric,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// =============================================
// ENUMS
// =============================================
export const tipoRegistroEnum = pgEnum("tipo_registro", [
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida",
]);

export const statusAjusteEnum = pgEnum("status_ajuste", [
  "pendente",
  "aprovado",
  "rejeitado",
]);

// =============================================
// EMPRESAS
// =============================================
export const empresas = pgTable("empresas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull().unique(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

// =============================================
// COLABORADORES
// =============================================
export const colaboradores = pgTable("colaboradores", {
  id: uuid("id").primaryKey().defaultRandom(),
  empresaId: uuid("empresa_id").references(() => empresas.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  pin: varchar("pin", { length: 6 }),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  cargo: varchar("cargo", { length: 100 }),
  departamento: varchar("departamento", { length: 100 }),
  jornadaDiaria: integer("jornada_diaria").default(540), // minutos (9h)
  perfil: varchar("perfil", { length: 20 }).notNull().default("colaborador"),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

// =============================================
// REGISTROS DE PONTO
// =============================================
export const registrosPonto = pgTable(
  "registros_ponto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    colaboradorId: uuid("colaborador_id")
      .references(() => colaboradores.id)
      .notNull(),
    tipo: tipoRegistroEnum("tipo").notNull(),
    dataHora: timestamp("data_hora").notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 8 }),
    longitude: numeric("longitude", { precision: 11, scale: 8 }),
    endereco: text("endereco"),
    dispositivo: varchar("dispositivo", { length: 255 }),
    ip: varchar("ip", { length: 45 }),
    offline: boolean("offline").default(false),
    sincronizado: boolean("sincronizado").default(true),
    hashRegistro: varchar("hash_registro", { length: 64 }).notNull(),
    criadoEm: timestamp("criado_em").defaultNow(),
  },
  (t) => [
    index("idx_registros_colaborador").on(t.colaboradorId),
    index("idx_registros_data").on(t.dataHora),
    index("idx_registros_colaborador_data").on(t.colaboradorId, t.dataHora),
  ]
);

// =============================================
// AJUSTES DE PONTO
// =============================================
export const ajustesPonto = pgTable("ajustes_ponto", {
  id: uuid("id").primaryKey().defaultRandom(),
  registroId: uuid("registro_id").references(() => registrosPonto.id),
  colaboradorId: uuid("colaborador_id")
    .references(() => colaboradores.id)
    .notNull(),
  dataReferencia: date("data_referencia", { mode: "string" }).notNull(),
  tipoAjuste: varchar("tipo_ajuste", { length: 20 }).notNull(),
  horaOriginal: timestamp("hora_original"),
  horaSolicitada: timestamp("hora_solicitada").notNull(),
  motivo: text("motivo").notNull(),
  status: statusAjusteEnum("status").default("pendente"),
  aprovadoPor: uuid("aprovado_por").references(() => colaboradores.id),
  criadoEm: timestamp("criado_em").defaultNow(),
});

// =============================================
// BANCO DE HORAS
// =============================================
export const bancoHoras = pgTable(
  "banco_horas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    colaboradorId: uuid("colaborador_id")
      .references(() => colaboradores.id)
      .notNull(),
    data: date("data", { mode: "string" }).notNull(), // YYYY-MM-DD
    horasTrabalhadas: integer("horas_trabalhadas").default(0), // minutos
    horasEsperadas: integer("horas_esperadas").default(0), // minutos
    saldo: integer("saldo").default(0), // minutos (+extra / -débito)
    criadoEm: timestamp("criado_em").defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_banco_horas_colab_data").on(t.colaboradorId, t.data),
    index("idx_banco_horas_colaborador").on(t.colaboradorId),
    index("idx_banco_horas_data").on(t.data),
  ]
);

// Tipos derivados
export type ColaboradorRow = typeof colaboradores.$inferSelect;
export type RegistroPontoRow = typeof registrosPonto.$inferSelect;
export type BancoHorasRow = typeof bancoHoras.$inferSelect;
