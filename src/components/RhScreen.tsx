"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ShieldCheck, TriangleAlert, UserCog } from "lucide-react";
import type { Colaborador, ToastTipo } from "@/lib/types";
import { gerarHtmlFolhaPonto } from "@/lib/format";

interface Props {
  session: { token: string; colaborador: Colaborador };
  online: boolean;
  notify: (texto: string, tipo?: ToastTipo) => void;
  onLogout: () => void;
}

interface UsuarioRh {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  departamento: string | null;
  perfil: "colaborador" | "rh" | "admin";
  jornadaDiaria: number | null;
}

interface ResumoDiaRh {
  nome: string;
  email: string;
  diasComErro: string[];
  totalDias: number;
  registros: { data: string; tipo: string; data_hora: string }[];
}

export default function RhScreen({ session, online, notify }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioRh[]>([]);
  const [relatorio, setRelatorio] = useState<ResumoDiaRh[]>([]);
  const [selecionado, setSelecionado] = useState<string>("all");
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("all");
  const [filtroDepartamento, setFiltroDepartamento] = useState("all");
  const [somenteAlertas, setSomenteAlertas] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState({
    cargo: "",
    departamento: "",
    perfil: "colaborador",
    jornadaDiaria: 540,
  });
  const [ajuste, setAjuste] = useState({
    colaboradorId: "",
    tipo: "entrada",
    data: new Date().toISOString().slice(0, 10),
    hora: "08:30",
    motivo: "Ajuste de ponto realizado pelo RH",
  });

  useEffect(() => {
    const carregar = async () => {
      if (!online) {
        notify("Conecte-se para consultar o painel do RH.", "erro");
        setCarregando(false);
        return;
      }

      try {
        const resUsuarios = await fetch("/api/rh/usuarios", {
          headers: { Authorization: `Bearer ${session.token}` },
        });

        if (!resUsuarios.ok) {
          throw new Error("Acesso negado");
        }

        const dataUsuarios = await resUsuarios.json();
        setUsuarios(dataUsuarios.usuarios ?? []);

        const resRelatorio = await fetch(
          `/api/rh/relatorio?mes=${mes}&ano=${ano}${selecionado !== "all" ? `&colaboradorId=${selecionado}` : ""}`,
          { headers: { Authorization: `Bearer ${session.token}` } }
        );

        if (!resRelatorio.ok) {
          throw new Error("Relatório indisponível");
        }

        const dataRelatorio = await resRelatorio.json();
        setRelatorio(dataRelatorio.relatorio ?? []);
      } catch {
        notify("Não foi possível carregar o painel de RH.", "erro");
      } finally {
        setCarregando(false);
      }
    };

    void carregar();
  }, [session.token, online, notify, mes, ano, selecionado]);

  const departamentos = useMemo(
    () => Array.from(new Set((usuarios.map((user) => user.departamento).filter(Boolean) as string[]))).sort(),
    [usuarios]
  );

  const relatorioFiltrado = useMemo(() => {
    return relatorio.filter((item) => {
      const texto = `${item.nome} ${item.email}`.toLowerCase();
      const buscaOk = !filtroBusca || texto.includes(filtroBusca.toLowerCase());
      const perfilOk = filtroPerfil === "all" || usuarios.some((user) => user.email === item.email && user.perfil === filtroPerfil);
      const departamentoOk = filtroDepartamento === "all" || usuarios.some((user) => user.email === item.email && user.departamento === filtroDepartamento);
      const alertaOk = !somenteAlertas || item.diasComErro.length > 0;
      return buscaOk && perfilOk && departamentoOk && alertaOk;
    });
  }, [relatorio, usuarios, filtroBusca, filtroPerfil, filtroDepartamento, somenteAlertas]);

  const totalDiasComErro = useMemo(
    () => relatorioFiltrado.reduce((acc, item) => acc + item.diasComErro.length, 0),
    [relatorioFiltrado]
  );

  useEffect(() => {
    if (usuarios.length > 0 && !ajuste.colaboradorId) {
      setAjuste((prev) => ({ ...prev, colaboradorId: usuarios[0].id }));
    }
  }, [usuarios, ajuste.colaboradorId]);

  useEffect(() => {
    if (selecionado !== "all" && usuarios.some((usuario) => usuario.id === selecionado)) {
      setAjuste((prev) => ({ ...prev, colaboradorId: selecionado }));
    }
  }, [selecionado, usuarios]);

  async function ajustarPontoRh() {
    if (!ajuste.colaboradorId || !ajuste.data || !ajuste.hora) {
      notify("Selecione colaborador, data e hora para ajustar o registro.", "erro");
      return;
    }

    try {
      const dataHora = new Date(`${ajuste.data}T${ajuste.hora}:00`);
      const res = await fetch("/api/rh/ajustes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          colaboradorId: ajuste.colaboradorId,
          tipo: ajuste.tipo,
          dataHora: dataHora.toISOString(),
          motivo: ajuste.motivo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao ajustar ponto");

      notify("Ponto ajustado com sucesso.", "sucesso");
      setAjuste((prev) => ({ ...prev, motivo: "Ajuste de ponto realizado pelo RH" }));
      setSelecionado(ajuste.colaboradorId);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao ajustar ponto.", "erro");
    }
  }

  async function salvarUsuario(userId: string) {
    try {
      const res = await fetch("/api/rh/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          id: userId,
          cargo: dadosEdicao.cargo,
          departamento: dadosEdicao.departamento,
          perfil: dadosEdicao.perfil,
          jornadaDiaria: Number(dadosEdicao.jornadaDiaria),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.erro || "Erro ao atualizar usuário");
      }

      setUsuarios((lista) =>
        lista.map((user) =>
          user.id === userId
            ? {
                ...user,
                cargo: dadosEdicao.cargo || user.cargo,
                departamento: dadosEdicao.departamento || user.departamento,
                perfil: (dadosEdicao.perfil as "colaborador" | "rh" | "admin") || user.perfil,
                jornadaDiaria: Number(dadosEdicao.jornadaDiaria) || user.jornadaDiaria,
              }
            : user
        )
      );
      setEditando(null);
      notify("Colaborador atualizado com sucesso.", "sucesso");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao atualizar colaborador.", "erro");
    }
  }

  const formatarDataBr = (valor: string) => {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatarHoraBr = (valor: string) => {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const exportarFolhaPdfColaborador = (usuario: ResumoDiaRh) => {
    const usuarioBase = usuarios.find((item) => item.email === usuario.email);
    const diasDoMes: Array<{
      dia: number;
      entrada: string | null;
      saida_almoco: string | null;
      volta_almoco: string | null;
      saida: string | null;
      total: string | null;
      saldo: string | null;
    }> = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, index) => {
      const d = new Date(ano, mes - 1, index + 1);
      return {
        dia: d.getDate(),
        entrada: null,
        saida_almoco: null,
        volta_almoco: null,
        saida: null,
        total: null,
        saldo: null,
      };
    });

    const mapaPorDia = new Map<string, Record<string, string>>();
    usuario.registros.forEach((registro) => {
      const key = registro.data;
      const atual = mapaPorDia.get(key) ?? {};
      atual[registro.tipo] = formatarHoraBr(registro.data_hora);
      mapaPorDia.set(key, atual);
    });

    diasDoMes.forEach((dia) => {
      const key = new Date(ano, mes - 1, dia.dia).toISOString().slice(0, 10);
      const registrosDia = mapaPorDia.get(key) ?? {};
      dia.entrada = registrosDia.entrada ?? null;
      dia.saida_almoco = registrosDia.saida_almoco ?? null;
      dia.volta_almoco = registrosDia.volta_almoco ?? null;
      dia.saida = registrosDia.saida ?? null;
    });

    const html = gerarHtmlFolhaPonto({
      nome: usuario.nome,
      cpf: "",
      cargo: usuarioBase?.cargo ?? "",
      departamento: usuarioBase?.departamento ?? "",
      mes,
      ano,
      saldoTotal: 0,
      linhas: diasDoMes.map((dia) => ({
        dia: dia.dia,
        entrada: dia.entrada,
        saida_almoco: dia.saida_almoco,
        volta_almoco: dia.volta_almoco,
        saida: dia.saida,
        total: null,
        saldo: null,
        valorHoraExtra: null,
      })),
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

    notify("A folha do colaborador foi enviada para impressão em PDF.", "sucesso");
  };

  const baixarCsv = () => {
    const linhas: string[] = [
      ["Nome", "E-mail", "Dias com erro", "Registros do mês"].join(","),
    ];

    relatorio.forEach((item) => {
      linhas.push([
        `"${item.nome}"`,
        `"${item.email}"`,
        `"${item.diasComErro.map(formatarDataBr).join("; ") || "-"}"`,
        item.registros.length,
      ].join(","));
    });

    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ponto-${ano}-${String(mes).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("Arquivo CSV gerado com sucesso.", "sucesso");
  };

  if (carregando) {
    return (
      <section className="tela ativa" style={{ padding: 20 }}>
        <h2 style={{ marginBottom: 18 }}>Painel RH</h2>
        <p>Carregando dados do mês…</p>
      </section>
    );
  }

  return (
    <section className="tela ativa">
      <div className="rh-dashboard-shell">
        <header className="rh-header-panel rh-panel">
          <div>
            <span className="section-kicker">Dashboard corporativo</span>
            <h2>RH / Administração</h2>
          </div>
          <p>Controle total do ponto e da operação.</p>
        </header>

        <div className="rh-layout">
          <aside className="rh-sidebar rh-panel">
            <div className="rh-section-head">
              <span>Visão geral</span>
            </div>

            <div className="rh-metric-grid">
              <div className="rh-metric rh-metric-primary">
                <span className="rh-metric-label">Colaboradores</span>
                <div className="rh-metric-value-wrap">
                  <span className="rh-metric-icon">●</span>
                  <strong>{usuarios.length}</strong>
                </div>
              </div>

              <div className="rh-metric rh-metric-danger">
                <span className="rh-metric-label">Dias com erro</span>
                <div className="rh-metric-value-wrap">
                  <span className="rh-metric-icon">!</span>
                  <strong>{totalDiasComErro}</strong>
                </div>
              </div>

              <div className="rh-metric rh-metric-neutral">
                <span className="rh-metric-label">Mês</span>
                <div className="rh-metric-value-wrap rh-metric-month-wrap">
                  <span className="rh-metric-icon">◔</span>
                  <strong className="rh-metric-month-value">
                    <span>{String(mes).padStart(2, "0")}</span>
                    <span>{ano}</span>
                  </strong>
                </div>
              </div>
            </div>

            <div className="rh-filter-stack">
              <div className="rh-field-group">
                <label>Mês</label>
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>

              <div className="rh-field-group">
                <label>Ano</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())}
                  min={2024}
                  max={2100}
                />
              </div>

              <div className="rh-field-group">
                <label>Colaborador</label>
                <select value={selecionado} onChange={(e) => setSelecionado(e.target.value)}>
                  <option value="all">Todos os colaboradores</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                  ))}
                </select>
              </div>

              <div className="rh-field-group">
                <label>Perfil</label>
                <select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)}>
                  <option value="all">Todos os perfis</option>
                  <option value="colaborador">Colaborador</option>
                  <option value="rh">RH</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="rh-field-group">
                <label>Departamento</label>
                <select value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}>
                  <option value="all">Todos os departamentos</option>
                  {departamentos.map((dep) => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>

              <label className="rh-toggle">
                <input type="checkbox" checked={somenteAlertas} onChange={(e) => setSomenteAlertas(e.target.checked)} />
                <span>Somente com alertas</span>
              </label>

              <div className="rh-field-group">
                <label>Busca</label>
                <input
                  type="search"
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  placeholder="Nome ou e-mail"
                />
              </div>

              <button className="btn btn-primary btn-export" onClick={baixarCsv}>
                <Download size={16} /> Baixar PDF
              </button>
            </div>
          </aside>

          <main className="rh-main">
            <section className="rh-panel rh-adjust-panel">
              <div className="rh-section-head with-action">
                <span>Ajuste de ponto manual</span>
                <small>Desktop / RH</small>
              </div>

              <div className="rh-adjust-grid">
                <div className="rh-field-group">
                  <label>Colaborador</label>
                  <select value={ajuste.colaboradorId} onChange={(e) => setAjuste((prev) => ({ ...prev, colaboradorId: e.target.value }))}>
                    {usuarios.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="rh-field-group">
                  <label>Tipo de registro</label>
                  <select value={ajuste.tipo} onChange={(e) => setAjuste((prev) => ({ ...prev, tipo: e.target.value }))}>
                    <option value="entrada">Entrada</option>
                    <option value="saida_almoco">Saída almoço</option>
                    <option value="volta_almoco">Volta almoço</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>

                <div className="rh-field-group">
                  <label>Data</label>
                  <input type="date" value={ajuste.data} onChange={(e) => setAjuste((prev) => ({ ...prev, data: e.target.value }))} />
                </div>

                <div className="rh-field-group">
                  <label>Horário</label>
                  <input type="time" value={ajuste.hora} onChange={(e) => setAjuste((prev) => ({ ...prev, hora: e.target.value }))} />
                </div>

                <div className="rh-field-group rh-field-wide">
                  <label>Motivo do ajuste</label>
                  <input
                    type="text"
                    value={ajuste.motivo}
                    onChange={(e) => setAjuste((prev) => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Motivo do ajuste"
                  />
                </div>
              </div>

              <div className="rh-adjust-actions">
                <button className="btn btn-primary" onClick={ajustarPontoRh}>Salvar ajuste do registro</button>
              </div>
            </section>

            <div className="rh-listing">
              {relatorioFiltrado.length === 0 ? (
                <div className="rh-panel rh-empty-state">
                  <p>Nenhum colaborador com dados no período.</p>
                </div>
              ) : (
                relatorioFiltrado.map((usuario) => (
                  <article key={usuario.email} className="rh-panel rh-record-card">
                    <div className="rh-record-head">
                      <div>
                        <strong>{usuario.nome}</strong>
                        <span>{usuario.email}</span>
                      </div>

                      {usuario.diasComErro.length > 0 ? (
                        <span className="rh-status-badge rg-danger">
                          <TriangleAlert size={14} /> {usuario.diasComErro.length} alertas
                        </span>
                      ) : (
                        <span className="rh-status-badge rg-success">
                          <ShieldCheck size={14} /> Sem alertas
                        </span>
                      )}
                    </div>

                    {usuario.diasComErro.length > 0 ? (
                      <div className="rh-alert-list">
                        <small>Dias com erro</small>
                        <div className="rh-chip-wrap">
                          {usuario.diasComErro.map((dia) => (
                            <span key={dia} className="rh-chip rh-chip-warning">{formatarDataBr(dia)}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rh-table-wrap">
                      <table className="rh-records-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Tipo de Registro</th>
                            <th>Horário</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuario.registros.length > 0 ? (
                            usuario.registros.map((r, index) => (
                              <tr key={`${r.data}-${index}`}>
                                <td>{formatarDataBr(r.data)}</td>
                                <td>{r.tipo}</td>
                                <td className="rh-time-cell">{formatarHoraBr(r.data_hora)}</td>
                                <td>
                                  <span className={`rh-row-status ${r.data_hora ? "ok" : "alert"}`}>
                                    {r.data_hora ? "OK" : "Revisar"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="rh-empty-row">Sem registros</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="rh-card-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btn-secondary" onClick={() => exportarFolhaPdfColaborador(usuario)}>
                        <Download size={16} /> Baixar PDF
                      </button>

                      {editando === usuario.email ? (
                        <div className="rh-edit-form" style={{ flex: 1, minWidth: 240 }}>
                          <input
                            value={dadosEdicao.cargo}
                            onChange={(e) => setDadosEdicao((prev) => ({ ...prev, cargo: e.target.value }))}
                            placeholder="Cargo"
                          />
                          <input
                            value={dadosEdicao.departamento}
                            onChange={(e) => setDadosEdicao((prev) => ({ ...prev, departamento: e.target.value }))}
                            placeholder="Departamento"
                          />
                          <select
                            value={dadosEdicao.perfil}
                            onChange={(e) => setDadosEdicao((prev) => ({ ...prev, perfil: e.target.value }))}
                          >
                            <option value="colaborador">Colaborador</option>
                            <option value="rh">RH</option>
                            <option value="admin">Admin</option>
                          </select>
                          <input
                            type="number"
                            value={dadosEdicao.jornadaDiaria}
                            onChange={(e) => setDadosEdicao((prev) => ({ ...prev, jornadaDiaria: Number(e.target.value) || 540 }))}
                            min={240}
                            max={720}
                          />
                          <div className="rh-edit-actions">
                            <button className="btn btn-primary" onClick={() => salvarUsuario(usuarios.find((u) => u.email === usuario.email)?.id ?? "")}>Salvar</button>
                            <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            const user = usuarios.find((u) => u.email === usuario.email);
                            if (!user) return;
                            setEditando(user.email);
                            setDadosEdicao({
                              cargo: user.cargo ?? "",
                              departamento: user.departamento ?? "",
                              perfil: user.perfil,
                              jornadaDiaria: user.jornadaDiaria ?? 540,
                            });
                          }}
                        >
                          <UserCog size={16} /> Ajustar conta
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
