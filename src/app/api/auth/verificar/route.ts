import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAuth, normalizePerfil } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// VERIFICAR TOKEN - GET /api/auth/verificar
// =============================================
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ erro: "Token não fornecido ou inválido" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: colaboradores.id,
        empresaId: colaboradores.empresaId,
        nome: colaboradores.nome,
        cpf: colaboradores.cpf,
        email: colaboradores.email,
        cargo: colaboradores.cargo,
        departamento: colaboradores.departamento,
        jornadaDiaria: colaboradores.jornadaDiaria,
        perfil: colaboradores.perfil,
      })
      .from(colaboradores)
      .where(and(eq(colaboradores.id, auth.id), eq(colaboradores.ativo, true)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ erro: "Colaborador não encontrado" }, { status: 404 });
    }

    const colaborador = rows[0];
    const perfil = normalizePerfil(colaborador.perfil, colaborador.cargo);

    return NextResponse.json({ colaborador: { ...colaborador, perfil } });
  } catch (error) {
    console.error("Erro na verificação:", error);
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
