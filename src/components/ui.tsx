"use client";

import {
  CheckCircle2,
  AlertCircle,
  Info,
  WifiOff,
  Home,
  History,
  FileText,
  MapPin,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import type { ToastMsg } from "@/lib/types";

// =============================================
// TOAST
// =============================================
export function Toast({ toast }: { toast: ToastMsg | null }) {
  if (!toast) return null;

  const Icone =
    toast.tipo === "sucesso" ? CheckCircle2 : toast.tipo === "erro" ? AlertCircle : Info;

  return (
    <div key={toast.id} className={`toast ${toast.tipo} show`} role="status">
      <Icone />
      <span>{toast.texto}</span>
    </div>
  );
}

// =============================================
// BANNER OFFLINE
// =============================================
export function OfflineBanner({ visivel }: { visivel: boolean }) {
  return (
    <div className={`offline-banner ${visivel ? "" : "hidden"}`}>
      <WifiOff size={14} />
      <span>Modo offline — os registros serão sincronizados automaticamente</span>
    </div>
  );
}

// =============================================
// NAVEGAÇÃO INFERIOR
// =============================================
export type Tela = "home" | "historico" | "espelho" | "admin";

export function BottomNav({
  telaAtiva,
  aoNavegar,
  mostrarAdmin = false,
}: {
  telaAtiva: Tela;
  aoNavegar: (tela: Tela) => void;
  mostrarAdmin?: boolean;
}) {
  const itens: { chave: Tela; label: string; Icone: typeof Home }[] = [
    { chave: "home", label: "Início", Icone: Home },
    { chave: "historico", label: "Histórico", Icone: History },
    { chave: "espelho", label: "Espelho", Icone: FileText },
    ...(mostrarAdmin ? [{ chave: "admin" as const, label: "RH", Icone: ShieldCheck }] : []),
  ];

  return (
    <nav className="nav-bottom">
      {itens.map(({ chave, label, Icone }) => (
        <button
          key={chave}
          className={`nav-item ${telaAtiva === chave ? "ativo" : ""}`}
          onClick={() => aoNavegar(chave)}
          aria-current={telaAtiva === chave ? "page" : undefined}
        >
          <Icone />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// =============================================
// SPLASH DE CARREGAMENTO
// =============================================
export function Splash() {
  return (
    <div className="splash">
      <div className="logo-icon">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo-ponto.svg" alt="Ponto Eletrônico" />
      </div>
      <p>Carregando seu ponto…</p>
    </div>
  );
}

// =============================================
// MODAL DE CONFIRMAÇÃO DE REGISTRO
// =============================================
export interface ModalConfirmState {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  hora: string;
  local: string;
  confirmando?: boolean;
}

export function ConfirmModal({
  estado,
  aoConfirmar,
  aoCancelar,
}: {
  estado: ModalConfirmState;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  if (!estado.aberto) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={estado.titulo}>
      <div className="modal-overlay" onClick={estado.confirmando ? undefined : aoCancelar} />
      <div className="modal-content">
        <div className="modal-icon">
          <LogIn />
        </div>
        <h3>{estado.titulo}</h3>
        <p>{estado.mensagem}</p>
        <div className="modal-info">
          <span className="modal-hora">{estado.hora}</span>
          <span className="modal-local">
            <MapPin />
            {estado.local}
          </span>
        </div>
        <div className="modal-acoes">
          <button className="btn btn-secondary" onClick={aoCancelar} disabled={estado.confirmando}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={aoConfirmar} disabled={estado.confirmando}>
            {estado.confirmando ? "Registrando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
