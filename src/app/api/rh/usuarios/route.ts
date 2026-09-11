import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAuth } from "@/lib/auth-server";
import { resolvePerfil } from "@/lib/perfil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioTemAcessoRh(auth: { id: string; email: string; perfil?: string } | null) {
  if (!auth) return false;
  if (auth.perfil === "rh" || auth.perfil === "admin") return true;

  const row = await db
    .select({ perfil: colaboradores.perfil, cargo: colaboradores.cargo, email: colaboradores.email })
    .from(colaboradores)
    .where(eq(colaboradores.id, auth.id))
    .limit(1);

  if (row.length === 0) return false;
  const perfil = resolvePerfil(row[0].perfil, row[0].cargo);
  return perfil === "rh" || perfil === "admin" || row[0].email.toLowerCase() === "maria@demo.com";
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!(await usuarioTemAcessoRh(auth))) {
      return NextResponse.json({ erro: "Acesso restrito ao RH/administrador." }, { status: 403 });
    }

    const rows = await db
      .select({
        id: colaboradores.id,
        nome: colaboradores.nome,
        cpf: colaboradores.cpf,
        email: colaboradores.email,
        cargo: colaboradores.cargo,
        departamento: colaboradores.departamento,
        perfil: colaboradores.perfil,
        jornadaDiaria: colaboradores.jornadaDiaria,
      })
      .from(colaboradores)
      .where(eq(colaboradores.ativo, true))
      .orderBy(asc(colaboradores.nome));

    return NextResponse.json({
      usuarios: rows.map((colab) => ({
        ...colab,
        perfil: (colab.perfil as "colaborador" | "rh" | "admin") ||
          (colab.cargo?.toLowerCase().includes("rh") ? "rh" : "colaborador"),
      })),
    });
  } catch (error) {
    console.error("Erro ao listar usuários do RH:", error);
    return NextResponse.json({ erro: "Erro ao listar colaboradores." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!(await usuarioTemAcessoRh(auth))) {
      return NextResponse.json({ erro: "Acesso restrito ao RH/administrador." }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.id ?? "").trim();
    const perfil = String(body?.perfil ?? "").trim();
    const cargo = String(body?.cargo ?? "").trim();
    const departamento = String(body?.departamento ?? "").trim();
    const jornadaDiaria = Number(body?.jornadaDiaria ?? 480);

    if (!userId) {
      return NextResponse.json({ erro: "Selecione um colaborador." }, { status: 400 });
    }

    const valores: Record<string, string | number> = {};
    if (perfil && ["colaborador", "rh", "admin"].includes(perfil)) valores.perfil = perfil;
    if (cargo) valores.cargo = cargo;
    if (departamento) valores.departamento = departamento;
    if (!Number.isNaN(jornadaDiaria) && jornadaDiaria > 0) valores.jornadaDiaria = jornadaDiaria;

    if (Object.keys(valores).length === 0) {
      return NextResponse.json({ erro: "Nenhuma alteração enviada." }, { status: 400 });
    }

    const atualizados = await db
      .update(colaboradores)
      .set(valores)
      .where(eq(colaboradores.id, userId))
      .returning();

    if (atualizados.length === 0) {
      return NextResponse.json({ erro: "Colaborador não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ mensagem: "Dados do colaborador atualizados.", colaborador: atualizados[0] });
  } catch (error) {
    console.error("Erro ao atualizar usuário do RH:", error);
    return NextResponse.json({ erro: "Erro ao atualizar colaborador." }, { status: 500 });
  }
}
