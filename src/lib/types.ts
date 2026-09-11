// =============================================
// TIPOS COMPARTILHADOS (cliente + servidor)
// =============================================

export type TipoRegistro = "entrada" | "saida_almoco" | "volta_almoco" | "saida";
export type PerfilColaborador = "colaborador" | "rh" | "admin";

export type ProximoTipo = TipoRegistro | "completo";

export interface Colaborador {
  id: string;
  empresaId: string | null;
  nome: string;
  cpf: string;
  email: string;
  pin?: string | null;
  cargo: string | null;
  departamento: string | null;
  jornadaDiaria: number | null;
  perfil?: PerfilColaborador;
}

export interface RegistroPontoDTO {
  id: string;
  tipo: TipoRegistro;
  data_hora: string;
  latitude: string | number | null;
  longitude: string | number | null;
  endereco: string | null;
  offline: boolean | null;
  pendente?: boolean; // só existe no cliente (IndexedDB)
}

export interface RegistroPendente {
  id?: number;
  tipo: TipoRegistro;
  data_hora: string;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  dispositivo: string;
  sincronizado: boolean;
  criado_em: string;
}

export interface BancoHorasDTO {
  data: string;
  horas_trabalhadas: number;
  horas_esperadas: number;
  saldo: number;
}

export interface EspelhoResponse {
  mes: number;
  ano: number;
  registros: { tipo: TipoRegistro; data_hora: string }[];
  bancoHoras: BancoHorasDTO[];
  totais: {
    trabalhado: number;
    esperado: number;
    saldo: number;
    trabalhadoFormatado: string;
    esperadoFormatado: string;
    saldoFormatado: string;
  };
}

export interface Session {
  token: string;
  colaborador: Colaborador;
}

export interface GeoPos {
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
}

export type ToastTipo = "sucesso" | "erro" | "info";

export interface ToastMsg {
  id: number;
  texto: string;
  tipo: ToastTipo;
}
