/**
 * SEED — Popula o banco com empresa, colaboradores e histórico realista.
 * Uso: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
});

const EMPRESA_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const JOAO_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MARIA_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

function hashReg(colabId: string, tipo: string, data: Date): string {
  return createHash("sha256").update(`${colabId}${tipo}${data.toISOString()}${Math.random()}`).digest("hex");
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function em(dia: Date, hh: number, mm: number): Date {
  const d = new Date(dia);
  d.setHours(hh, mm, rand(0, 59), 0);
  return d;
}

async function inserirDia(
  colabId: string,
  dia: Date,
  opcoes?: { extra?: boolean; semAlmoco?: boolean }
) {
  const entrada = em(dia, 7, rand(42, 59));
  const saidaAlmoco = em(dia, rand(11, 12), rand(45, 59));
  const voltaAlmoco = new Date(saidaAlmoco.getTime() + rand(58, 75) * 60000);
  const saida = em(dia, opcoes?.extra ? rand(18, 19) : 17, rand(2, 58));

  const registros: [string, Date][] = [["entrada", entrada]];
  if (!opcoes?.semAlmoco) {
    registros.push(["saida_almoco", saidaAlmoco], ["volta_almoco", voltaAlmoco]);
  }
  registros.push(["saida", saida]);

  for (const [tipo, dataHora] of registros) {
    await pool.query(
      `INSERT INTO registros_ponto (colaborador_id, tipo, data_hora, latitude, longitude, endereco, dispositivo, ip, offline, sincronizado, hash_registro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, $9)`,
      [
        colabId,
        tipo,
        dataHora,
        -23.5505 + Math.random() * 0.01,
        -46.6333 + Math.random() * 0.01,
        "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "187.44.12.9",
        hashReg(colabId, tipo, dataHora),
      ]
    );
  }

  // banco de horas do dia
  let minutos = 0;
  if (!opcoes?.semAlmoco) {
    minutos += (saidaAlmoco.getTime() - entrada.getTime()) / 60000;
    minutos += (saida.getTime() - voltaAlmoco.getTime()) / 60000;
  } else {
    minutos += (saida.getTime() - entrada.getTime()) / 60000;
    minutos -= 60; // desconto do almoço
  }
  minutos = Math.round(minutos);
  const dataStr = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;

  await pool.query(
    `INSERT INTO banco_horas (colaborador_id, data, horas_trabalhadas, horas_esperadas, saldo)
     VALUES ($1, $2, $3, 480, $4)
     ON CONFLICT (colaborador_id, data)
     DO UPDATE SET horas_trabalhadas = $3, saldo = $4`,
    [colabId, dataStr, minutos, minutos - 480]
  );
}

async function ensurePerfilColumn() {
  const existe = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'colaboradores' AND column_name = 'perfil'
     LIMIT 1`
  );

  if (existe.rowCount === 0) {
    console.log("⚠️ Coluna 'perfil' ausente em colaboradores. Adicionando compatibilidade...");
    await pool.query(
      `ALTER TABLE colaboradores
       ADD COLUMN perfil VARCHAR(20) NOT NULL DEFAULT 'colaborador'`
    );
  }

  await pool.query(
    `UPDATE colaboradores
     SET perfil = 'colaborador'
     WHERE perfil IS NULL OR perfil = ''`
  );
}

async function main() {
  console.log("🌱 Iniciando seed...");
  await ensurePerfilColumn();

  // Empresa
  await pool.query(
    `INSERT INTO empresas (id, nome, cnpj) VALUES ($1, $2, $3)
     ON CONFLICT (cnpj) DO NOTHING`,
    [EMPRESA_ID, "Empresa Demo", "00.000.000/0001-00"]
  );

  // Colaboradores (senha: 123456)
  const senhaHash = bcrypt.hashSync("123456", 10);
  await pool.query(
    `INSERT INTO colaboradores (id, empresa_id, nome, cpf, email, pin, senha_hash, cargo, departamento, jornada_diaria)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 480)
     ON CONFLICT (cpf) DO NOTHING`,
    [JOAO_ID, EMPRESA_ID, "João Silva", "123.456.789-00", "joao@demo.com", "1234", senhaHash, "Desenvolvedor", "TI"]
  );
  await pool.query(
    `INSERT INTO colaboradores (id, empresa_id, nome, cpf, email, pin, senha_hash, cargo, departamento, jornada_diaria, perfil)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (cpf) DO UPDATE SET perfil = EXCLUDED.perfil, cargo = EXCLUDED.cargo, departamento = EXCLUDED.departamento, jornada_diaria = EXCLUDED.jornada_diaria`,
    [MARIA_ID, EMPRESA_ID, "Maria Souza", "987.654.321-00", "maria@demo.com", "5678", senhaHash, "Analista de RH", "Recursos Humanos", 480, "rh"]
  );

  // Limpar histórico anterior do seed
  await pool.query(`DELETE FROM registros_ponto WHERE colaborador_id IN ($1, $2)`, [JOAO_ID, MARIA_ID]);
  await pool.query(`DELETE FROM banco_horas WHERE colaborador_id IN ($1, $2)`, [JOAO_ID, MARIA_ID]);

  // Histórico do João: últimos 55 dias (dias úteis), exceto hoje
  let inseridos = 0;
  for (let i = 55; i >= 1; i--) {
    const dia = new Date();
    dia.setDate(dia.getDate() - i);
    const dow = dia.getDay();
    if (dow === 0 || dow === 6) continue; // fim de semana

    const sorteio = Math.random();
    if (sorteio < 0.06) continue; // falta / folga
    if (sorteio < 0.14) {
      await inserirDia(JOAO_ID, dia, { semAlmoco: true }); // meio período / saída médica
    } else if (sorteio < 0.24) {
      await inserirDia(JOAO_ID, dia, { extra: true }); // hora extra
    } else {
      await inserirDia(JOAO_ID, dia);
    }
    inseridos++;
  }

  // Histórico da Maria: últimos 7 dias úteis
  for (let i = 10; i >= 1; i--) {
    const dia = new Date();
    dia.setDate(dia.getDate() - i);
    const dow = dia.getDay();
    if (dow === 0 || dow === 6) continue;
    await inserirDia(MARIA_ID, dia, { extra: Math.random() < 0.2 });
    inseridos++;
  }

  console.log(`✅ Seed concluído: ${inseridos} dias de registros inseridos.`);
  console.log("   Logins demo → joao@demo.com / 123456  •  maria@demo.com / 123456  •  PIN 1234 ou 5678");
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Erro no seed:", err);
  await pool.end();
  process.exit(1);
});
