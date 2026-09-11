// =============================================
// HELPERS DE FORMATAÇÃO (cliente + servidor)
// =============================================

export function formatarMinutos(minutos: number, comSinal = false): string {
  const sinal = minutos < 0 ? "-" : comSinal ? "+" : "";
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function formatarDinheiro(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor.toFixed(2)));
}

export function formatarHora(isoOuData: string | Date): string {
  const d = typeof isoOuData === "string" ? new Date(isoOuData) : isoOuData;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dataPorExtenso(d: Date): string {
  return capitalize(
    d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
}

export function diaSemanaCurto(d: Date): string {
  return capitalize(
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    })
  );
}

export function escaparCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? "").replace(/\r?\n/g, " ").trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

export function gerarHtmlFolhaPonto(params: {
  nome: string;
  cpf?: string;
  cargo?: string;
  departamento?: string;
  mes: number;
  ano: number;
  saldoTotal?: number;
  linhas: Array<{
    dia: number;
    entrada: string | null;
    saida_almoco: string | null;
    volta_almoco: string | null;
    saida: string | null;
    total: string | null;
    saldo: string | null;
    valorHoraExtra?: string | null;
  }>;
}): string {
  const { nome, cpf = "", cargo = "", departamento = "", mes, ano, saldoTotal = 0, linhas } = params;

  const linhasHtml = linhas.map((linha) => {
    const cells = [
      `<td class="dia">${String(linha.dia).padStart(2, "0")}</td>`,
      `<td>${linha.entrada ?? ""}</td>`,
      `<td>${linha.saida_almoco ?? ""}</td>`,
      `<td>${linha.volta_almoco ?? ""}</td>`,
      `<td>${linha.saida ?? ""}</td>`,
      `<td>${linha.valorHoraExtra ?? ""}</td>`,
      `<td>${linha.saldo ?? ""}</td>`,
    ].join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Folha de Ponto</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            margin: 0;
            background: #fff;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }
          .page {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 10px 18px 0;
            box-sizing: border-box;
          }
          .titulo {
            font-weight: 900;
            font-size: 17px;
            text-align: center;
            letter-spacing: 0.02em;
            margin: 6px 0 10px;
            text-transform: uppercase;
          }
          .mes-ano {
            display: inline-block;
            min-width: 150px;
            border-bottom: 2px solid #111;
            padding-bottom: 2px;
            margin: 0 10px;
            vertical-align: middle;
          }
          .bloco {
            border: 2px solid #111;
            border-radius: 0;
            margin-top: 10px;
            overflow: hidden;
          }
          .bloco h3 {
            margin: 0;
            background: #f2f2f2;
            border-bottom: 2px solid #111;
            font-size: 13px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            text-align: center;
            padding: 6px 8px;
            font-weight: 800;
          }
          .top-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border: 2px solid #111;
            margin-top: 10px;
          }
          .top-grid .cell {
            padding: 6px 10px;
            min-height: 24px;
            font-size: 12px;
            border-right: 1px solid #111;
          }
          .top-grid .cell:last-child {
            border-right: none;
          }
          .top-grid strong {
            font-weight: 700;
          }
          .single-line {
            display: flex;
            align-items: center;
            min-height: 28px;
          }
          .single-line .label {
            font-weight: 700;
            margin-right: 8px;
            white-space: nowrap;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 10px;
            border: 2px solid #111;
          }
          th, td {
            border: 1px solid #111;
            padding: 0;
            height: 20px;
            text-align: center;
            font-size: 11px;
            box-sizing: border-box;
          }
          th {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            background: #f8f8f8;
            height: 28px;
          }
          .dia {
            width: 52px;
            font-weight: 700;
            background: #fafafa;
          }
          tr td:first-child {
            font-weight: 700;
            background: #f7f7f7;
          }
          .assinatura {
            margin-top: 14px;
            font-size: 12px;
            border-top: 1px solid #111;
            padding-top: 4px;
            text-align: left;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="titulo">
            Folha de ponto | mês/ano:
            <span class="mes-ano">${String(mes).padStart(2, "0")}</span>
            /
            <span class="mes-ano">${ano}</span>
          </div>

          <div class="top-grid">
            <div class="cell"><span class="single-line"><span class="label">Nome:</span> ${nome || ""}</span></div>
            <div class="cell"><span class="single-line"><span class="label">CPF:</span> ${cpf || ""}</span></div>
          </div>

          <div class="top-grid" style="margin-top: 0; border-top: 0;">
            <div class="cell"><span class="single-line"><span class="label">Cargo:</span> ${cargo || ""}</span></div>
            <div class="cell"><span class="single-line"><span class="label">Departamento:</span> ${departamento || ""}</span></div>
          </div>

          <div class="top-grid" style="margin-top: 0; border-top: 0;">
            <div class="cell"><span class="single-line"><span class="label">Horário de trabalho contratado:</span> ${PONTO_CONFIG.horarioSemana.inicio} às ${PONTO_CONFIG.horarioSemana.fim}</span></div>
            <div class="cell"><span class="single-line"><span class="label">Sábado:</span> ${PONTO_CONFIG.horarioSabado.inicio} às ${PONTO_CONFIG.horarioSabado.fim}</span></div>
          </div>

          <div class="top-grid" style="margin-top: 0; border-top: 0;">
            <div class="cell"><span class="single-line"><span class="label">Domingo:</span> ${PONTO_CONFIG.horarioDomingo.inicio} às ${PONTO_CONFIG.horarioDomingo.fim}</span></div>
            <div class="cell"><span class="single-line"><span class="label">Saldo a receber:</span> ${formatarDinheiro(saldoTotal)}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:40px;">Dia<br />mês</th>
                <th>Entrada</th>
                <th>Início do almoço</th>
                <th>Fim do almoço</th>
                <th>Saída</th>
                <th>Hora extra</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}
