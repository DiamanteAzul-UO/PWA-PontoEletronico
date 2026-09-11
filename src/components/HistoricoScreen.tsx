"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarX2, LogIn, LogOut, MapPin, RotateCcw, Utensils } from "lucide-react";
import type { RegistroPontoDTO, Session, TipoRegistro, ToastTipo } from "@/lib/types";
import { TIPO_LABEL, calcularMinutosFechados } from "@/lib/jornada";
import { capitalize, dayKey, formatarHora, formatarMinutos } from "@/lib/format";

interface Props {
  session: Session;
  online: boolean;
  notify: (texto: string, tipo?: ToastTipo) => void;
}

type Periodo = "dia" | "semana" | "mes";

const TIPO_ICONE: Record<TipoRegistro, typeof LogIn> = {
  entrada: LogIn,
  saida_almoco: Utensils,
  volta_almoco: RotateCcw,
  saida: LogOut,
};

function limitesPeriodo(periodo: Periodo): { inicio: Date; fim: Date } {
  const agora = new Date();
  const inicio = new Date(agora);
  const fim = new Date(agora);
  fim.setHours(23, 59, 59, 999);

  switch (periodo) {
    case "semana":
      inicio.setDate(agora.getDate() - agora.getDay());
      inicio.setHours(0, 0, 0, 0);
      break;
    case "mes":
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      break;
    default:
      inicio.setHours(0, 0, 0, 0);
  }
  return { inicio, fim };
}

export default function HistoricoScreen({ session, online, notify }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [registros, setRegistros] = useState<RegistroPontoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(
    async (p: Periodo) => {
      setCarregando(true);
      try {
        const { inicio, fim } = limitesPeriodo(p);
        const res = await fetch(
          `/api/historico/registros?inicio=${inicio.getTime()}&fim=${fim.getTime()}`,
          { headers: { Authorization: `Bearer ${session.token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setRegistros(data.registros ?? []);
        } else if (res.status === 503) {
          notify("Histórico indisponível offline", "info");
          setRegistros([]);
        } else {
          notify("Erro ao carregar histórico", "erro");
        }
      } catch {
        notify("Histórico exige conexão com a internet", "info");
        setRegistros([]);
      }
      setCarregando(false);
    },
    [session.token, notify]
  );

  useEffect(() => {
    if (online) carregar(periodo);
    else {
      setCarregando(false);
      setRegistros([]);
    }
  }, [periodo, online, carregar]);

  // agrupa por dia (mais recente primeiro)
  const grupos = useMemo(() => {
    const mapa = new Map<string, RegistroPontoDTO[]>();
    for (const reg of registros) {
      const chave = dayKey(new Date(reg.data_hora));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(reg);
    }
    return Array.from(mapa.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [registros]);

  return (
    <section className="tela ativa">
      <header className="app-header">
        <span />
        <h2 className="header-title">Histórico</h2>
        <span style={{ width: 40 }} />
      </header>

      <div className="filtros-container">
        {(
          [
            ["dia", "Hoje"],
            ["semana", "Semana"],
            ["mes", "Mês"],
          ] as [Periodo, string][]
        ).map(([chave, label]) => (
          <button
            key={chave}
            className={`filtro-btn ${periodo === chave ? "ativo" : ""}`}
            onClick={() => setPeriodo(chave)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="historico-lista">
        {carregando ? (
          <>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        ) : !online ? (
          <p className="timeline-vazio">
            <CalendarX2 style={{ display: "block", margin: "0 auto 10px" }} />
            Histórico disponível apenas online
          </p>
        ) : grupos.length === 0 ? (
          <p className="timeline-vazio">
            <CalendarX2 style={{ display: "block", margin: "0 auto 10px" }} />
            Nenhum registro no período
          </p>
        ) : (
          grupos.map(([chave, regs], gi) => {
            const data = new Date(`${chave}T12:00:00`);
            const ordenados = [...regs].sort(
              (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
            );
            const totalDia = calcularMinutosFechados(
              ordenados.map((r) => ({ tipo: r.tipo, dataHora: new Date(r.data_hora) }))
            );
            return (
              <div className="historico-dia-grupo anim-in" key={chave} style={{ animationDelay: `${gi * 0.06}s` }}>
                <div className="historico-dia-header">
                  <span>
                    {capitalize(
                      data.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    )}
                  </span>
                  {totalDia > 0 && (
                    <span className="historico-dia-total">{formatarMinutos(totalDia)}</span>
                  )}
                </div>
                <div className="timeline-items">
                  {ordenados.map((reg) => {
                    const Icone = TIPO_ICONE[reg.tipo];
                    const detalhe = reg.endereco
                      ? reg.endereco
                      : reg.latitude != null && reg.longitude != null
                        ? `${Number(reg.latitude).toFixed(5)}, ${Number(reg.longitude).toFixed(5)}`
                        : null;
                    return (
                      <div key={reg.id} className="timeline-item">
                        <div className={`timeline-item-icon ${reg.tipo}`}>
                          <Icone />
                        </div>
                        <div className="timeline-item-info">
                          <div className="timeline-item-tipo">{TIPO_LABEL[reg.tipo]}</div>
                          {detalhe && (
                            <div className="timeline-item-detalhe" title={detalhe}>
                              <MapPin />
                              {detalhe}
                            </div>
                          )}
                        </div>
                        <div className="timeline-item-direita">
                          <span className="timeline-item-hora">{formatarHora(reg.data_hora)}</span>
                          {reg.offline && <span className="tag-offline">offline</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
