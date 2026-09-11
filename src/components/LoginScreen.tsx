"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, LogIn, User, UserPlus, WifiOff } from "lucide-react";
import type { Colaborador } from "@/lib/types";
import { buscarDadoUsuario } from "@/lib/offline";

interface Props {
  online: boolean;
  onSucesso: (token: string, colaborador: Colaborador) => void;
}

export default function LoginScreen({ online, onSucesso }: Props) {
  const [modoCadastro, setModoCadastro] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  void lembrar;

  function preencherDemo(id: string, s: string) {
    setIdentificador(id);
    setSenha(s);
    setErro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (entrando) return;

    if (modoCadastro) {
      if (!nome.trim() || !cpf.trim() || !email.trim() || !senha || !pin.trim()) {
        setErro("Preencha nome, CPF, e-mail, senha e PIN para criar a conta.");
        return;
      }

      setEntrando(true);
      setErro(null);

      try {
        const res = await fetch("/api/auth/cadastrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            cpf: cpf.trim(),
            email: email.trim(),
            senha,
            pin: pin.trim(),
          }),
        });

        const data = await res.json();
        if (res.ok) {
          onSucesso(data.token, data.colaborador);
          return;
        }
        setErro(data.erro || "Erro ao criar conta");
      } catch {
        setErro("Não foi possível criar a conta no momento.");
      } finally {
        setEntrando(false);
      }
      return;
    }

    const id = identificador.trim();
    if (!id || !senha) {
      setErro("Preencha todos os campos");
      return;
    }

    setEntrando(true);
    setErro(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador: id, senha }),
      });

      const data = await res.json();

      if (res.ok) {
        onSucesso(data.token, data.colaborador);
      } else {
        setErro(data.erro || "Erro ao fazer login");
      }
    } catch {
      try {
        const tokenLocal = await buscarDadoUsuario<string>("token");
        const colabLocal = await buscarDadoUsuario<Colaborador>("colaborador");
        if (tokenLocal && colabLocal) {
          onSucesso(tokenLocal, colabLocal);
        } else {
          setErro("Sem conexão e sem dados em cache. Conecte-se à internet.");
        }
      } catch {
        setErro("Sem conexão com o servidor.");
      }
    }

    setEntrando(false);
  }

  return (
    <section className="tela ativa">
      <div className="login-container">
        <div className="login-header anim-in">
          <div className="logo-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo-ponto.svg" alt="Ponto Eletrônico" />
          </div>
          <h1>{modoCadastro ? "Criar conta" : "Ponto Eletrônico"}</h1>
          <p>{modoCadastro ? "Cadastre seu acesso ao sistema" : "Registre sua jornada de trabalho"}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form anim-in" style={{ animationDelay: "0.08s" }}>
          {modoCadastro && (
            <>
              <div className="input-group">
                <label htmlFor="nome">
                  <User /> Nome completo
                </label>
                <input id="nome" type="text" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div className="input-group">
                <label htmlFor="cpf">
                  <User /> CPF
                </label>
                <input id="cpf" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>

              <div className="input-group">
                <label htmlFor="email">
                  <User /> E-mail
                </label>
                <input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="input-group">
                <label htmlFor="pin">
                  <Lock /> PIN
                </label>
                <input id="pin" type="password" placeholder="Ex.: 1234" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} />
              </div>
            </>
          )}

          {!modoCadastro && (
            <div className="input-group">
              <label htmlFor="identificador">
                <User /> CPF, e-mail ou PIN
              </label>
              <input
                id="identificador"
                type="text"
                placeholder="Digite seu CPF, e-mail ou PIN"
                autoComplete="username"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
              />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="senha">
              <Lock /> Senha
            </label>
            <div className="senha-wrapper">
              <input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                placeholder={modoCadastro ? "Crie uma senha" : "Digite sua senha"}
                autoComplete={modoCadastro ? "new-password" : "current-password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                className="btn-toggle-senha"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {!modoCadastro && (
            <div className="checkbox-group">
              <input
                id="lembrar"
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
              />
              <label htmlFor="lembrar">Manter conectado</label>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={entrando}>
            {entrando ? (
              <>
                <Loader2 className="animate-spin" /> {modoCadastro ? "Cadastrando…" : "Entrando…"}
              </>
            ) : (
              <>
                {modoCadastro ? <UserPlus /> : <LogIn />} {modoCadastro ? "Criar conta" : "Entrar"}
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-full"
            onClick={() => {
              setModoCadastro((v) => !v);
              setErro(null);
            }}
            style={{ marginTop: 10 }}
          >
            {modoCadastro ? "Já tenho conta" : "Criar nova conta"}
          </button>

          {erro && <div className="mensagem-erro">{erro}</div>}
          {!online && !erro && (
            <div className="mensagem-erro" style={{ borderColor: "rgba(255,209,102,0.35)", color: "#ffd166", background: "rgba(255,209,102,0.07)" }}>
              <WifiOff size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
              Você está offline — entre com a última sessão salva neste aparelho
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
