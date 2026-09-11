"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    const registrar = async () => {
      try {
        const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        registro.addEventListener("updatefound", () => {
          const sw = registro.installing;
          if (!sw) return;

          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") {
              window.location.reload();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        await registro.update();
      } catch {
        // registro de SW falhou — app continua funcionando online
      }
    };

    void registrar();
  }, []);

  return null;
}
