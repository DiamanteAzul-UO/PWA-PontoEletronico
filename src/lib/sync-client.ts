"use client";

import {
  buscarPendentes,
  limparSincronizados,
  marcarSincronizado,
} from "./offline";

// =============================================
// SINCRONIZAÇÃO DE REGISTROS OFFLINE → SERVIDOR
// =============================================

interface SyncResultadoItem {
  local_id: number;
  sincronizado: boolean;
}

export async function sincronizarPendentes(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  try {
    const pendentes = await buscarPendentes();
    if (pendentes.length === 0) return 0;

    const token = localStorage.getItem("token");
    if (!token) return 0;

    const response = await fetch("/api/ponto/sincronizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ registros: pendentes }),
    });

    if (!response.ok) return 0;

    const data = await response.json();
    let sincronizados = 0;

    for (const resultado of (data.resultados || []) as SyncResultadoItem[]) {
      if (resultado.sincronizado) {
        await marcarSincronizado(resultado.local_id);
        sincronizados++;
      }
    }

    await limparSincronizados();
    return sincronizados;
  } catch {
    return 0;
  }
}

export function registrarBackgroundSync(): void {
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  ) {
    navigator.serviceWorker.ready
      .then((registration) =>
        // @ts-expect-error - Background Sync API ainda não tipada
        registration.sync.register("sync-registros")
      )
      .catch(() => undefined);
  }
}

export function escutarSyncDoServiceWorker(callback: () => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }

  const handler = (event: MessageEvent) => {
    if (event.data?.tipo === "SYNC_REGISTROS") callback();
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
