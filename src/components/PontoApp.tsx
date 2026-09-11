"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Colaborador, Session, ToastMsg, ToastTipo } from "@/lib/types";
import { contarPendentes, salvarDadoUsuario } from "@/lib/offline";
import {
  escutarSyncDoServiceWorker,
  sincronizarPendentes,
} from "@/lib/sync-client";
import { BottomNav, OfflineBanner, Splash, Toast, type Tela } from "./ui";
import { isRhAccess, resolvePerfil } from "@/lib/perfil";
import LoginScreen from "./LoginScreen";
import HomeScreen from "./HomeScreen";
import HistoricoScreen from "./HistoricoScreen";
import EspelhoScreen from "./EspelhoScreen";
import RhScreen from "./RhScreen";

export default function PontoApp() {
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [tela, setTela] = useState<"login" | Tela>("login");
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- notificações ----------
  const notify = useCallback((texto: string, tipo: ToastTipo = "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), texto, tipo });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // ---------- pendentes ----------
  const refreshPendentes = useCallback(async () => {
    setPendentes(await contarPendentes());
  }, []);

  // ---------- sincronização ----------
  const sincronizar = useCallback(
    async (silencioso = false): Promise<number> => {
      const qtd = await sincronizarPendentes();
      await refreshPendentes();
      if (!silencioso && qtd > 0) {
        notify(
          qtd === 1
            ? "1 registro offline sincronizado"
            : `${qtd} registros offline sincronizados`,
          "sucesso"
        );
      }
      return qtd;
    },
    [notify, refreshPendentes]
  );

  // ---------- sessão ----------
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("colaborador");
    setSession(null);
    setTela("login");
    notify("Sessão encerrada", "info");
  }, [notify]);

  const onLoginSucesso = useCallback(
    async (token: string, colaborador: Colaborador) => {
      const colaboradorNormalizado = {
        ...colaborador,
        perfil: resolvePerfil(colaborador.perfil, colaborador.cargo),
      };

      localStorage.setItem("token", token);
      localStorage.setItem("colaborador", JSON.stringify(colaboradorNormalizado));
      try {
        await salvarDadoUsuario("token", token);
        await salvarDadoUsuario("colaborador", colaboradorNormalizado);
      } catch {
        // IndexedDB indisponível — segue com localStorage
      }
      setSession({ token, colaborador: colaboradorNormalizado });
      setTela("home");
      notify(`Bem-vindo(a), ${colaboradorNormalizado.nome.split(" ")[0]}!`, "sucesso");
    },
    [notify]
  );

  // ---------- bootstrap ----------
  useEffect(() => {
    let ativo = true;

    (async () => {
      setOnline(navigator.onLine);

      const token = localStorage.getItem("token");
      const colabRaw = localStorage.getItem("colaborador");

      if (token && colabRaw) {
        try {
          const colaborador = {
            ...JSON.parse(colabRaw),
            perfil: resolvePerfil(JSON.parse(colabRaw).perfil, JSON.parse(colabRaw).cargo),
          } as Colaborador;
          if (ativo) {
            setSession({ token, colaborador });
            setTela("home");
          }
          // valida sessão em segundo plano (apenas online)
          if (navigator.onLine) {
            fetch("/api/auth/verificar", {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((res) => {
                if (res.status === 401) {
                  localStorage.removeItem("token");
                  localStorage.removeItem("colaborador");
                  if (ativo) {
                    setSession(null);
                    setTela("login");
                  }
                } else if (res.ok) {
                  res.json().then((data) => {
                    if (ativo && data.colaborador) {
                      const colaboradorAtualizado = {
                        ...data.colaborador,
                        perfil: resolvePerfil(data.colaborador.perfil, data.colaborador.cargo),
                      };
                      localStorage.setItem("colaborador", JSON.stringify(colaboradorAtualizado));
                      setSession({ token, colaborador: colaboradorAtualizado });
                    }
                  });
                }
              })
              .catch(() => undefined);
          }
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("colaborador");
        }
      }

      await refreshPendentes();
      if (ativo) setCarregando(false);
    })();

    // conectividade
    const aoVoltarOnline = () => {
      setOnline(true);
      notify("Conexão restaurada — sincronizando…", "info");
      sincronizar();
    };
    const aoFicarOffline = () => {
      setOnline(false);
      notify("Sem conexão — modo offline ativado", "info");
    };

    window.addEventListener("online", aoVoltarOnline);
    window.addEventListener("offline", aoFicarOffline);

    // sync periódico
    const intervalo = setInterval(() => {
      if (navigator.onLine) sincronizar(true);
    }, 30000);

    // sync disparado pelo service worker
    const removerListener = escutarSyncDoServiceWorker(() => sincronizar(true));

    return () => {
      ativo = false;
      window.removeEventListener("online", aoVoltarOnline);
      window.removeEventListener("offline", aoFicarOffline);
      clearInterval(intervalo);
      removerListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render ----------
  if (carregando) return <Splash />;

  return (
    <>
      <OfflineBanner visivel={!online} />
      <Toast toast={toast} />

      {tela === "login" || !session ? (
        <LoginScreen online={online} onSucesso={onLoginSucesso} />
      ) : (
        <>
          {tela === "home" && (
            <HomeScreen
              session={session}
              online={online}
              pendentes={pendentes}
              notify={notify}
              onLogout={logout}
              onSync={() => sincronizar()}
              refreshPendentes={refreshPendentes}
            />
          )}
          {tela === "historico" && (
            <HistoricoScreen session={session} online={online} notify={notify} />
          )}
          {tela === "espelho" && (
            <EspelhoScreen session={session} online={online} notify={notify} />
          )}
          {tela === "admin" && (
            <RhScreen session={session} online={online} notify={notify} onLogout={logout} />
          )}
          <BottomNav
            telaAtiva={tela}
            aoNavegar={setTela}
            mostrarAdmin={isRhAccess(
              session.colaborador.email,
              session.colaborador.perfil,
              session.colaborador.cargo
            )}
          />
        </>
      )}
    </>
  );
}
