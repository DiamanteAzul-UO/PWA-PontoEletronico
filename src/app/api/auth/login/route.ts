import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { colaboradores } from "@/db/schema";
import { normalizePerfil, signToken } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// LOGIN - POST /api/auth/login
// =============================================
export async function POST(req: NextRequest) {
  try {
    const { identificador, senha } = await req.json();

    if (!identificador || !senha) {
      return NextResponse.json(
        { erro: "Identificador e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar por CPF, e-mail ou PIN
    const rows = await db
      .select()
      .from(colaboradores)
      .where(
        and(
          eq(colaboradores.ativo, true),
          or(
            eq(colaboradores.cpf, identificador),
            eq(colaboradores.email, identificador),
            eq(colaboradores.pin, identificador)
          )
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ erro: "Colaborador não encontrado" }, { status: 401 });
    }

    const colaborador = rows[0];

    const senhaValida = await bcrypt.compare(senha, colaborador.senhaHash);
    if (!senhaValida) {
      return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
    }

    const perfil = normalizePerfil(colaborador.perfil, colaborador.cargo);

    const token = signToken({
      id: colaborador.id,
      email: colaborador.email,
      empresaId: colaborador.empresaId,
      perfil,
    });

    const { senhaHash: _omit, ...colab } = colaborador;
    void _omit;

    return NextResponse.json({
      mensagem: "Login realizado com sucesso",
      token,
      colaborador: colab,
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
