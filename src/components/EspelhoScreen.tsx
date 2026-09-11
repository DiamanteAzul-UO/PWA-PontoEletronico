"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Download, Scale, Target } from "lucide-react";
import type { BancoHorasDTO, EspelhoResponse, Session, TipoRegistro, ToastTipo } from "@/lib/types";
import {
  capitalize,
  dayKey,
  formatarDinheiro,
  formatarHora,
  formatarMinutos,
  gerarHtmlFolhaPonto,
} from "@/lib/format";
import {
  calcularHorasExtrasEmMinutos,
  calcularJornadaEsperadaDoDia,
  calcularMinutosExtrasPorRegistros,
  calcularMinutosFechados,
  calcularValorFinanceiroDoDia,
} from "@/lib/jornada";

interface Props {
  session: Session;
  online: boolean;
  notify: (texto: string, tipo?: ToastTipo) => void;
}

export default function EspelhoScreen({ session, online, notify }: Props) {
  const hoje = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dados, setDados] = useState<EspelhoResponse | null>(null);
  const [carregando, setCarregando] = useState(true);

  const mesAtualRef = hoje.getMonth() + 1 === mes && hoje.getFullYear() === ano;

  const carregar = useCallback(
    async (m: number, a: number) => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/historico/espelho?mes=${m}&ano=${a}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) {
          setDados(await res.json());
        } else {
          notify("Erro ao carregar espelho de ponto", "erro");
          setDados(null);
        }
      } catch {
        notify("Espelho exige conexão com a internet", "info");
        setDados(null);
      }
      setCarregando(false);
    },
    [session.token, notify]
  );

  useEffect(() => {
    if (online) carregar(mes, ano);
    else {
      setCarregando(false);
      setDados(null);
    }
  }, [mes, ano, online, carregar]);

  function navegar(delta: number) {
    const d = new Date(ano, mes - 1 + delta, 1);
    setMes(d.getMonth() + 1);
    setAno(d.getFullYear());
  }

  const baixarFolhaPdf = () => {
    if (!linhas.length) return;

    const html = gerarHtmlFolhaPonto({
      nome: session.colaborador.nome,
      cpf: session.colaborador.cpf ?? "",
      cargo: session.colaborador.cargo ?? "",
      departamento: session.colaborador.departamento ?? "",
      mes,
      ano,
      saldoTotal: valorMensal,
      linhas: linhas.map((linha) => {
        const dataDia = new Date(ano, mes - 1, linha.dia);
        const chave = dayKey(dataDia);
        const registrosDia = porDia.get(chave) ?? [];
        const minutosTrabalhados = registrosDia.length
          ? calcularMinutosFechados(
              registrosDia.map((r) => ({ tipo: r.tipo, dataHora: new Date(r.data_hora) }))
            )
          : 0;
        const jornadaDia = calcularJornadaEsperadaDoDia(dataDia) || session.colaborador.jornadaDiaria || 540;
        const minutosExtra = calcularHorasExtrasEmMinutos(dataDia, minutosTrabalhados, jornadaDia);
        const saldoDia = calcularValorFinanceiroDoDia(dataDia, minutosTrabalhados, jornadaDia);

        return {
          dia: linha.dia,
          entrada: linha.horarios[0] ?? null,
          saida_almoco: linha.horarios[1] ?? null,
          volta_almoco: linha.horarios[2] ?? null,
          saida: linha.horarios[3] ?? null,
          total: linha.total ?? null,
          saldo: formatarDinheiro(saldoDia),
          valorHoraExtra: minutosExtra > 0 ? `+${formatarMinutos(minutosExtra)}` : null,
        };
      }),
    });

    const janela = window.open("", "_blank", "width=1200,height=1000");
    if (!janela) {
      notify("O navegador bloqueou a janela de impressão. Permita pop-ups para baixar o PDF.", "erro");
      return;
    }

    janela.document.write(html);
    janela.document.close();
    setTimeout(() => {
      janela.focus();
      janela.print();
    }, 250);

    notify("A janela de impressão foi aberta para salvar em PDF.", "sucesso");
  };

  // registros agrupados por dia local
  const porDia = useMemo(() => {
    const mapa = new Map<string, { tipo: TipoRegistro; data_hora: string }[]>();
    for (const reg of dados?.registros ?? []) {
      const chave = dayKey(new Date(reg.data_hora));
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(reg);
    }
    return mapa;
  }, [dados]);

  const bancoPorDia = useMemo(() => {
    const mapa = new Map<string, BancoHorasDTO>();
    for (const b of dados?.bancoHoras ?? []) mapa.set(b.data, b);
    return mapa;
  }, [dados]);

  const valorMensal = useMemo(() => {
    if (!dados) return 0;

    return Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, index) => {
      const data = new Date(ano, mes - 1, index + 1);
      const chave = dayKey(data);
      const registrosDia = porDia.get(chave) ?? [];
      const minutosTrabalhados = registrosDia.length
        ? calcularMinutosFechados(
            registrosDia.map((r) => ({ tipo: r.tipo, dataHora: new Date(r.data_hora) }))
          )
        : 0;

      return calcularValorFinanceiroDoDia(data, minutosTrabalhados, calcularJornadaEsperadaDoDia(data));
    }).reduce((total, valor) => total + valor, 0);
  }, [dados, porDia, ano, mes]);

  const linhas = useMemo(() => {
    const totalDias = new Date(ano, mes, 0).getDate();
    const limite = mesAtualRef ? hoje.getDate() : totalDias;
    const lista: {
      chave: string;
      dia: number;
      semana: string;
      fds: boolean;
      ehHoje: boolean;
      horarios: (string | null)[];
      total: string | null;
      saldo: number | null;
    }[] = [];

    for (let dia = 1; dia <= limite; dia++) {
      const data = new Date(ano, mes - 1, dia);
      const chave = dayKey(data);
      const regs = (porDia.get(chave) ?? []).slice().sort(
        (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      );

      const ordem: TipoRegistro[] = ["entrada", "saida_almoco", "volta_almoco", "saida"];
      const horarios = ordem.map((tipo) => {
        const r = regs.find((x) => x.tipo === tipo);
        return r ? formatarHora(r.data_hora) : null;
      });

      const banco = bancoPorDia.get(chave);
      let total: string | null = null;
      let saldo: number | null = null;

      if (banco) {
        total = banco.horas_trabalhadas > 0 ? formatarMinutos(banco.horas_trabalhadas) : null;
        saldo = banco.horas_trabalhadas > 0 ? banco.saldo : null;
      } else if (regs.length > 0) {
        const min = calcularMinutosFechados(
          regs.map((r) => ({ tipo: r.tipo, dataHora: new Date(r.data_hora) }))
        );
        total = min > 0 ? formatarMinutos(min) + "…" : null;
      }

      lista.push({
        chave,
        dia,
        semana: data.toLocaleDateString("pt-BR", { weekday: "short" }),
        fds: data.getDay() === 0 || data.getDay() === 6,
        ehHoje: chave === dayKey(new Date()),
        horarios,
        total,
        saldo,
      });
    }

    return lista;
  }, [ano, mes, porDia, bancoPorDia, mesAtualRef, hoje]);

  return (
    <section className="tela ativa">
      <header className="app-header" style={{ padding: "16px 20px 0" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.14), rgba(15,23,42,0.7))", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 18, padding: "18px 18px 14px", boxShadow: "0 10px 28px rgba(15,23,42,0.28)" }}>
          <h2 className="header-title" style={{ margin: 0, fontSize: 28, letterSpacing: "-0.04em" }}>Espelho de Ponto</h2>
        </div>
      </header>

      {/* Seletor de mês */}
      <div className="mes-seletor" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 18, padding: "10px 12px", margin: "16px 20px 0" }}>
        <button className="btn-icon" onClick={() => navegar(-1)} aria-label="Mês anterior">
          <ChevronLeft />
        </button>
        <span>
          {capitalize(new Date(ano, mes - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}
        </span>
        <button
          className="btn-icon"
          onClick={() => navegar(1)}
          disabled={mesAtualRef}
          style={mesAtualRef ? { opacity: 0.35, pointerEvents: "none" } : undefined}
          aria-label="Próximo mês"
        >
          <ChevronRight />
        </button>
        <button className="btn btn-primary" onClick={baixarFolhaPdf} style={{ marginLeft: 8, borderRadius: 12 }}>
          <Download size={16} /> Baixar PDF
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="resumo-cards anim-in">
        <div className="resumo-card">
          <Clock3 />
          <span className="resumo-valor">
            {carregando ? "--:--" : (dados?.totais.trabalhadoFormatado ?? "00:00")}
          </span>
          <span className="resumo-label">Trabalhado</span>
        </div>
        <div className="resumo-card">
          <Target />
          <span className="resumo-valor">
            {carregando ? "--:--" : (dados?.totais.esperadoFormatado ?? "00:00")}
          </span>
          <span className="resumo-label">Esperado</span>
        </div>
        <div
          className={`resumo-card saldo ${
            dados ? (dados.totais.saldo >= 0 ? "positivo" : "negativo") : ""
          }`}
        >
          <Scale />
          <span className="resumo-valor">
            {carregando ? "--:--" : (dados?.totais.saldoFormatado ?? "00:00")}
          </span>
          <span className="resumo-label">Saldo</span>
        </div>        <div className="resumo-card">
          <Target />
          <span className="resumo-valor">
            {carregando ? "--:--" : formatarDinheiro(valorMensal)}
          </span>
          <span className="resumo-label">Receita</span>
        </div>      </div>

      {/* Tabela */}
      <div className="espelho-tabela-container">
        {carregando ? (
          <>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        ) : !online ? (
          <p className="timeline-vazio">Espelho disponível apenas online</p>
        ) : (
          <table className="espelho-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Saída Alm.</th>
                <th>Volta Alm.</th>
                <th>Saída</th>
                <th>Total</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr
                  key={linha.chave}
                  className={`${linha.fds ? "fds" : ""} ${linha.ehHoje ? "hoje" : ""}`}
                >
                  <td>
                    <span className="dia-label">
                      {String(linha.dia).padStart(2, "0")}
                      <small>{linha.semana.replace(".", "")}</small>
                    </span>
                  </td>
                  {linha.horarios.map((h, i) => (
                    <td key={i} className={h ? "" : "vazio"}>
                      {h ?? "--:--"}
                    </td>
                  ))}
                  <td className={linha.total ? "" : "vazio"}>{linha.total ?? "--:--"}</td>
                  <td
                    className={
                      linha.saldo == null
                        ? "vazio"
                        : linha.saldo >= 0
                          ? "positivo"
                          : "negativo"
                    }
                  >
                    {linha.saldo == null ? "--:--" : formatarMinutos(linha.saldo, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
