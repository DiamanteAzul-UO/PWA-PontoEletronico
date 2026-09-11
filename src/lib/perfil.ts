export type PerfilColaborador = "colaborador" | "rh" | "admin";

export function resolvePerfil(perfil?: string | null, fallback?: string | null): PerfilColaborador {
  const valor = (perfil ?? fallback ?? "colaborador").toString().trim().toLowerCase();

  if (valor === "admin") return "admin";
  if (valor === "rh" || valor.includes("rh") || valor.includes("recursos humanos")) return "rh";
  return "colaborador";
}

export function isRhAccess(_email?: string | null, perfil?: string | null, cargo?: string | null): boolean {
  const cargoOk = (cargo ?? "").toLowerCase().includes("rh") || (cargo ?? "").toLowerCase().includes("recursos humanos");
  const perfilOk = resolvePerfil(perfil, cargo) === "rh" || resolvePerfil(perfil, cargo) === "admin";
  return cargoOk || perfilOk;
}
