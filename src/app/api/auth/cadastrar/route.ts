import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { colaboradores } from "@/db/schema";
import { signToken } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nome = String(body?.nome ?? "").trim();
    const cpf = String(body?.cpf ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const senha = String(body?.senha ?? "");
    const pin = String(body?.pin ?? "").trim();

    if (!nome || !cpf || !email || !senha || !pin) {
      return NextResponse.json({ erro: "Preencha nome, CPF, e-mail, senha e PIN." }, { status: 400 });
    }

    if (senha.length < 6) {
      return NextResponse.json({ erro: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    if (pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ erro: "O PIN deve ter entre 4 e 6 dígitos." }, { status: 400 });
    }

    const cpfExistente = await db
      .select({ id: colaboradores.id })
      .from(colaboradores)
      .where(eq(colaboradores.cpf, cpf))
      .limit(1);

    if (cpfExistente.length > 0) {
      return NextResponse.json({ erro: "CPF já cadastrado." }, { status: 409 });
    }

    const emailExistente = await db
      .select({ id: colaboradores.id })
      .from(colaboradores)
      .where(eq(colaboradores.email, email))
      .limit(1);

    if (emailExistente.length > 0) {
      return NextResponse.json({ erro: "E-mail já cadastrado." }, { status: 409 });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const [colaborador] = await db
      .insert(colaboradores)
      .values({
        nome,
        cpf,
        email,
        pin,
        senhaHash,
        cargo: "Colaborador",
        departamento: "Operação",
        jornadaDiaria: 540,
        perfil: "colaborador",
        ativo: true,
      })
      .returning();

    const token = signToken({
      id: colaborador.id,
      email: colaborador.email,
      empresaId: colaborador.empresaId,
      perfil: "colaborador",
    });

    const { senhaHash: _omit, ...payload } = colaborador;
    void _omit;

    return NextResponse.json({
      mensagem: "Conta criada com sucesso",
      token,
      colaborador: payload,
    });
  } catch (error) {
    console.error("Erro ao cadastrar colaborador:", error);
    return NextResponse.json({ erro: "Erro interno ao criar a conta" }, { status: 500 });
  }
}
