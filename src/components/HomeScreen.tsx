"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Utensils,
} from "lucide-react";
import type {
  GeoPos,
  ProximoTipo,
  RegistroPontoDTO,
  Session,
  TipoRegistro,
  ToastTipo,
} from "@/lib/types";
import {
  calcularJornadaEsperadaDoDia,
  calcularMinutosTrabalhados,
  calcularProximoTipo,
  calcularValorFinanceiroDoDia,
  estaNoLocalTrabalho,
  LOCAL_TRABALHO,
  STATUS_TEXTO,
  TIPO_LABEL,
} from "@/lib/jornada";
import { dataPorExtenso, formatarDinheiro, formatarHora, formatarMinutos } from "@/lib/format";
import {
  buscarRegistrosLocaisDoDia,
  salvarRegistroPendente,
} from "@/lib/offline";
import { registrarBackgroundSync } from "@/lib/sync-client";
import { ConfirmModal, type ModalConfirmState } from "./ui";

interface Props {
  session: Session;
  online: boolean;
  pendentes: number;
  notify: (texto: string, tipo?: ToastTipo) => void;
  onLogout: () => void;
  onSync: () => Promise<number>;
  refreshPendentes: () => Promise<void>;
}

const BOTOES_CONFIG: Record<
  ProximoTipo,
  { texto: string; dica: string; Icone: typeof LogIn; classe: string }
> = {
  entrada: {
    texto: "Registrar Entrada",
    dica: "Toque para iniciar sua jornada",
    Icone: LogIn,
    classe: "",
  },
  saida_almoco: {
    texto: "Saída Almoço",
    dica: "Registre sua saída para o almoço",
    Icone: Utensils,
    classe: "saida-almoco",
  },
  volta_almoco: {
    texto: "Volta Almoço",
    dica: "Registre seu retorno do almoço",
    Icone: RotateCcw,
    classe: "volta-almoco",
  },
  saida: {
    texto: "Registrar Saída",
    dica: "Toque para encerrar sua jornada",
    Icone: LogOut,
    classe: "saida",
  },
  completo: {
    texto: "Jornada Completa",
    dica: "Todos os registros do dia foram feitos",
    Icone: CheckCircle2,
    classe: "completo",
  },
};

const TIPO_ICONE: Record<TipoRegistro, typeof LogIn> = {
  entrada: LogIn,
  saida_almoco: Utensils,
  volta_almoco: RotateCcw,
  saida: LogOut,
};

function capturarGeolocalizacao(): Promise<{ latitude: number | null; longitude: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  });
}

async function enderecoPorCoordenadas(
  latitude: number | null,
  longitude: number | null
): Promise<string | null> {
  if (latitude == null || longitude == null) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const partes = [
      a.road && a.house_number ? `${a.road}, ${a.house_number}` : a.road,
      a.suburb || a.neighbourhood || a.city_district,
      a.city || a.town || a.municipality,
    ].filter(Boolean);
    return partes.slice(0, 3).join(" - ") || data.display_name || null;
  } catch {
    return null;
  }
}

export default function HomeScreen({
  session,
  online,
  pendentes,
  notify,
  onLogout,
  onSync,
  refreshPendentes,
}: Props) {
  const [agora, setAgora] = useState<Date | null>(null);
  const [registrosDia, setRegistrosDia] = useState<RegistroPontoDTO[]>([]);
  const [modal, setModal] = useState<ModalConfirmState>({
    aberto: false,
    titulo: "",
    mensagem: "",
    hora: "",
    local: "",
  });
  const [sincronizando, setSincronizando] = useState(false);
  const [localPermitido, setLocalPermitido] = useState(false);
  const geoRef = useRef<GeoPos>({ latitude: null, longitude: null, endereco: null });

  const jornada = session.colaborador.jornadaDiaria ?? calcularJornadaEsperadaDoDia(agora ?? new Date());

  // ---------- relógio ----------
  useEffect(() => {
    setAgora(new Date());
    const iv = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ---------- estado derivado do dia ----------
  const tipos = useMemo(
    () => registrosDia.map((r) => r.tipo),
    [registrosDia]
  );
  const proximoTipo = useMemo(() => calcularProximoTipo(tipos), [tipos]);
  const minutosTrabalhados = useMemo(
    () =>
      calcularMinutosTrabalhados(
        registrosDia.map((r) => ({ tipo: r.tipo, dataHora: new Date(r.data_hora) })),
        agora ?? new Date()
      ),
    [registrosDia, agora]
  );

  async function verificarLocalizacaoAtual(): Promise<boolean> {
    if (!navigator.geolocation) {
      setLocalPermitido(true);
      return true;
    }

    const coords = await new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });

    const localDisponivel = coords.latitude != null && coords.longitude != null;
    const permitido = localDisponivel ? estaNoLocalTrabalho(coords.latitude, coords.longitude) : true;
    setLocalPermitido(permitido);
    return permitido;
  }

  useEffect(() => {
    if (!online) {
      setLocalPermitido(false);
      return;
    }

    void verificarLocalizacaoAtual();
  }, [online]);

  // ---------- carregar registros do dia (servidor + pendentes locais) ----------
  const carregarStatus = useCallback(async () => {
    let registros: RegistroPontoDTO[] = [];

    if (navigator.onLine) {
      try {
        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);
        const res = await fetch(`/api/ponto/status?inicio=${inicioHoje.getTime()}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          registros = data.registros ?? [];
        }
      } catch {
        // mantém lista do servidor vazia
      }
    }

    try {
      const locais = await buscarRegistrosLocaisDoDia();
      const pendentesDTO: RegistroPontoDTO[] = locais.map((l) => ({
        id: `local-${l.id}`,
        tipo: l.tipo,
        data_hora: l.data_hora,
        latitude: l.latitude,
        longitude: l.longitude,
        endereco: l.endereco,
        offline: true,
        pendente: true,
      }));
      registros = [...registros, ...pendentesDTO];
    } catch {
      // IndexedDB indisponível
    }

    registros.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
    setRegistrosDia(registros);
  }, [session.token]);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus, online, pendentes]);

  // re-sincronizar quando voltar online já tratado no PontoApp

  // ---------- fluxo de registro ----------
  async function abrirModal() {
    if (proximoTipo === "completo") return;

    if (!online) {
      notify("Você precisa estar online para validar o local de trabalho.", "erro");
      return;
    }

    const localOk = await verificarLocalizacaoAtual();
    if (!localOk && navigator.geolocation) {
      notify(`Você precisa estar no endereço ${LOCAL_TRABALHO.nome}.`, "erro");
      return;
    }

    const cfg = BOTOES_CONFIG[proximoTipo];
    geoRef.current = { latitude: null, longitude: null, endereco: null };

    setModal({
      aberto: true,
      titulo: `Confirmar ${TIPO_LABEL[proximoTipo]}`,
      mensagem: cfg.dica,
      hora: formatarHora(new Date()),
      local: online ? "Capturando localização…" : "Sem GPS no modo offline",
    });

    if (online) {
      const coords = await capturarGeolocalizacao();
      geoRef.current.latitude = coords.latitude;
      geoRef.current.longitude = coords.longitude;
      const endereco = await enderecoPorCoordenadas(coords.latitude, coords.longitude);
      geoRef.current.endereco = endereco;
      setModal((m) =>
        m.aberto
          ? {
              ...m,
              local: endereco
                ? endereco
                : coords.latitude != null
                  ? `${coords.latitude.toFixed(5)}, ${coords.longitude?.toFixed(5)}`
                  : "Localização não disponível",
            }
          : m
      );
    }
  }

  async function confirmarRegistro() {
    const tipo = proximoTipo as TipoRegistro;
    if (proximoTipo === "completo" || modal.confirmando) return;

    const localOk = await verificarLocalizacaoAtual();
    if (!localOk && navigator.geolocation) {
      notify(`Você precisa estar no endereço ${LOCAL_TRABALHO.nome}.`, "erro");
      setModal({ aberto: false, titulo: "", mensagem: "", hora: "", local: "" });
      return;
    }

    setModal((m) => ({ ...m, confirmando: true }));
    const geo = geoRef.current;
    const horaRegistro = new Date();

    const salvarOffline = async () => {
      await salvarRegistroPendente({
        tipo,
        data_hora: horaRegistro.toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        endereco: geo.endereco,
        dispositivo: navigator.userAgent,
      });
      registrarBackgroundSync();
      await refreshPendentes();
      await carregarStatus();
      notify(`${TIPO_LABEL[tipo]} registrada offline às ${formatarHora(horaRegistro)}`, "info");
    };

    if (online) {
      try {
        const res = await fetch("/api/ponto/registrar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            tipo,
            latitude: geo.latitude,
            longitude: geo.longitude,
            endereco: geo.endereco,
            dispositivo: navigator.userAgent,
            offline: false,
          }),
        });

        if (res.ok) {
          notify(`${TIPO_LABEL[tipo]} registrada às ${formatarHora(horaRegistro)}`, "sucesso");
        } else if (res.status === 409) {
          const data = await res.json();
          notify(data.erro || "Registro duplicado", "erro");
        } else {
          const data = await res.json().catch(() => ({}));
          if (data.offline) {
            await salvarOffline();
          } else {
            notify((data as { erro?: string }).erro || "Erro ao registrar ponto", "erro");
          }
        }
      } catch {
        await salvarOffline();
      }
    } else {
      await salvarOffline();
    }

    setModal({ aberto: false, titulo: "", mensagem: "", hora: "", local: "" });
    await carregarStatus();
  }

  // ---------- sync manual ----------
  async function handleSync() {
    if (sincronizando) return;
    setSincronizando(true);
    await onSync();
    await carregarStatus();
    setTimeout(() => setSincronizando(false), 700);
  }

  // ---------- saudação ----------
  const hora = agora?.getHours() ?? 12;
  const saudacao = hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite";

  const cfg = BOTOES_CONFIG[proximoTipo];
  const BotaoIcone = cfg.Icone;

  const statusDotClasse =
    proximoTipo === "entrada"
      ? "aguardando"
      : proximoTipo === "volta_almoco"
        ? "almoco"
        : proximoTipo === "completo"
          ? "completo"
          : "trabalhando";

  const valorDia = calcularValorFinanceiroDoDia(agora ?? new Date(), minutosTrabalhados, jornada);
  const progresso = Math.min(100, Math.round((minutosTrabalhados / jornada) * 100));

  return (
    <section className="tela ativa">
      {/* Header */}
      <header className="app-header">
        <div className="header-info">
          <h2>{saudacao}!</h2>
          <p className="nome-colab">{session.colaborador.nome}</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn-icon ${sincronizando ? "sincronizando" : ""}`}
            title="Sincronizar"
            onClick={handleSync}
          >
            <RefreshCw />
            {pendentes > 0 && <span className="badge-pendentes">{pendentes}</span>}
          </button>
          <button className="btn-icon" title="Sair" onClick={onLogout}>
            <LogOut />
          </button>
        </div>
      </header>

      {/* Relógio */}
      <div className="relogio-container">
        <div className="relogio-digital" aria-live="off">
          <span className="hora">{agora ? String(agora.getHours()).padStart(2, "0") : "--"}</span>
          <span className="separador">:</span>
          <span className="minuto">{agora ? String(agora.getMinutes()).padStart(2, "0") : "--"}</span>
          <span className="segundo">{agora ? String(agora.getSeconds()).padStart(2, "0") : "--"}</span>
        </div>
        <p className="data-atual">{agora ? dataPorExtenso(agora) : "…"}</p>
      </div>

      {/* Status da jornada */}
      <div className="status-jornada anim-in">
        <div className="status-item">
          <span className="status-label">Status</span>
          <span className="status-valor">
            <span className={`status-dot ${statusDotClasse}`} />
            {STATUS_TEXTO[proximoTipo]}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Trabalhado hoje</span>
          <span className="status-valor">{formatarMinutos(minutosTrabalhados)}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Rendimento</span>
          <span className="status-valor">{formatarDinheiro(valorDia)}</span>
        </div>
      </div>

      {!online && !localPermitido && (
        <p className="registro-dica" style={{ marginTop: -8, marginBottom: 8 }}>
          <MapPin /> Necessário estar no local de trabalho para registrar ponto.
        </p>
      )}

      {/* Barra de progresso da jornada */}
      <div className="jornada-progresso anim-in" style={{ animationDelay: "0.05s" }}>
        <div className="jornada-progresso-labels">
          <span>Jornada do dia</span>
          <span>
            {progresso}% de {formatarMinutos(jornada)}
          </span>
        </div>
        <div className="jornada-barra">
          <div
            className={`jornada-barra-fill ${progresso >= 100 ? "completa" : ""}`}
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* Botão de registro */}
      <div className="registro-container anim-in" style={{ animationDelay: "0.1s" }}>
        <div className={`btn-ponto-wrap ${cfg.classe}`}>
          <button
            id="btn-registrar"
            className="btn-ponto"
            onClick={abrirModal}
            disabled={proximoTipo === "completo" || !localPermitido}
            aria-label={cfg.texto}
          >
            <div className="btn-ponto-inner">
              <BotaoIcone strokeWidth={1.6} />
              <span>{cfg.texto}</span>
            </div>
            <div className="btn-ponto-ripple" />
          </button>
        </div>
        <p className="registro-dica">
          {proximoTipo === "completo" ? <CheckCircle2 /> : <MousePointerClick />}
          {!online ? `${cfg.dica} (offline)` : localPermitido ? cfg.dica : `Acesso liberado somente em ${LOCAL_TRABALHO.nome}`}
        </p>
      </div>

      {/* Timeline do dia */}
      <div className="timeline-dia anim-in" style={{ animationDelay: "0.15s" }}>
        <h3>
          <Clock3 /> Registros de hoje
        </h3>
        <div className="timeline-items">
          {registrosDia.length === 0 ? (
            <p className="timeline-vazio">Nenhum registro hoje</p>
          ) : (
            registrosDia.map((reg, i) => {
              const Icone = TIPO_ICONE[reg.tipo];
              const detalhe = reg.endereco
                ? reg.endereco
                : reg.latitude != null && reg.longitude != null
                  ? `${Number(reg.latitude).toFixed(5)}, ${Number(reg.longitude).toFixed(5)}`
                  : "Sem localização";
              return (
                <div
                  key={reg.id}
                  className={`timeline-item ${reg.pendente ? "is-pendente" : ""}`}
                  style={{ animationDelay: `${0.15 + i * 0.06}s` }}
                >
                  <div className={`timeline-item-icon ${reg.tipo}`}>
                    <Icone />
                  </div>
                  <div className="timeline-item-info">
                    <div className="timeline-item-tipo">{TIPO_LABEL[reg.tipo]}</div>
                    <div className="timeline-item-detalhe" title={detalhe}>
                      <MapPin />
                      {detalhe}
                    </div>
                  </div>
                  <div className="timeline-item-direita">
                    <span className="timeline-item-hora">{formatarHora(reg.data_hora)}</span>
                    {reg.pendente ? (
                      <span className="tag-pendente">aguardando sync</span>
                    ) : reg.offline ? (
                      <span className="tag-offline">offline</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      <ConfirmModal
        estado={modal}
        aoConfirmar={confirmarRegistro}
        aoCancelar={() => setModal({ aberto: false, titulo: "", mensagem: "", hora: "", local: "" })}
      />

      {/* indicador de captura de GPS no modal */}
      {modal.aberto && modal.confirmando && (
        <span className="hidden" aria-hidden>
          <Loader2 />
        </span>
      )}
    </section>
  );
}
