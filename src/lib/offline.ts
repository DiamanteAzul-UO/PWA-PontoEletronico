"use client";

import type { RegistroPendente } from "./types";

// =============================================
// IndexedDB — ARMAZENAMENTO LOCAL OFFLINE
// =============================================

const DB_NAME = "PontoEletronicoDB";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("registros_pendentes")) {
        const store = db.createObjectStore("registros_pendentes", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("sincronizado", "sincronizado", { unique: false });
        store.createIndex("data_hora", "data_hora", { unique: false });
      }

      if (!db.objectStoreNames.contains("usuario")) {
        db.createObjectStore("usuario", { keyPath: "chave" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function salvarRegistroPendente(
  registro: Omit<RegistroPendente, "id" | "sincronizado" | "criado_em">
): Promise<RegistroPendente> {
  const db = await openDB();
  const dados: Omit<RegistroPendente, "id"> = {
    ...registro,
    sincronizado: false,
    criado_em: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["registros_pendentes"], "readwrite");
    const store = tx.objectStore("registros_pendentes");
    const request = store.add(dados);

    request.onsuccess = () => resolve({ ...dados, id: request.result as number });
    request.onerror = () => reject(request.error);
  });
}

export async function buscarPendentes(): Promise<RegistroPendente[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["registros_pendentes"], "readonly");
    const store = tx.objectStore("registros_pendentes");
    const request = store.getAll();

    request.onsuccess = () => {
      const todos = (request.result || []) as RegistroPendente[];
      resolve(todos.filter((r) => !r.sincronizado));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function marcarSincronizado(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["registros_pendentes"], "readwrite");
    const store = tx.objectStore("registros_pendentes");
    const request = store.get(id);

    request.onsuccess = () => {
      const registro = request.result as RegistroPendente | undefined;
      if (registro) {
        registro.sincronizado = true;
        store.put(registro);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function limparSincronizados(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["registros_pendentes"], "readwrite");
    const store = tx.objectStore("registros_pendentes");
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const valor = cursor.value as RegistroPendente;
        if (valor.sincronizado) cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function contarPendentes(): Promise<number> {
  try {
    const pendentes = await buscarPendentes();
    return pendentes.length;
  } catch {
    return 0;
  }
}

export async function salvarDadoUsuario(chave: string, valor: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["usuario"], "readwrite");
    tx.objectStore("usuario").put({ chave, valor });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function buscarDadoUsuario<T>(chave: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["usuario"], "readonly");
    const request = tx.objectStore("usuario").get(chave);
    request.onsuccess = () => resolve((request.result?.valor as T) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function buscarRegistrosLocaisDoDia(): Promise<RegistroPendente[]> {
  const pendentes = await buscarPendentes();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return pendentes.filter((r) => new Date(r.data_hora) >= hoje);
}
