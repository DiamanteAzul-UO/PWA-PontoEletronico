# README de Deploy no Windows Server — Ponto Eletrônico

Este guia foi escrito para Windows Server, sem Linux, sem SSH e sem ambiente Ubuntu. O objetivo é deixar o sistema de ponto eletrônico em produção no Windows com PostgreSQL, Node.js, serviço do Windows e proxy reverso opcional.

## 1) Requisitos do Windows Server

Recomendado:

- Windows Server 2019 ou 2022
- 2 vCPUs e 4 GB RAM mínimo
- acesso administrativo local ou via RDP
- PostgreSQL 16
- Node.js 22 LTS
- Nginx ou IIS opcional para proxy reverso
- certificado HTTPS (Let's Encrypt, Win ACME, Cloudflare ou IIS/Certbot)

## 2) Preparar o repositório no GitHub

### 2.1. Subir o projeto para o GitHub

No seu computador local:

```bash
git init
git add .
git commit -m "Primeiro deploy"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

Se o projeto já estiver no GitHub:

```bash
git pull origin main
```

## 3) Instalar e preparar o Windows Server

### 3.1. Instalar Node.js 22 LTS

Baixe e instale o Node.js 22 LTS em execução como administrador.

Verifique:

```powershell
node -v
npm -v
```

### 3.2. Instalar PostgreSQL

Instale o PostgreSQL 16 no Windows Server e configure a senha do usuário `postgres`.

Depois abra o terminal do PostgreSQL ou o SQL Shell.

### 3.3. Criar usuário e banco

```sql
CREATE USER appuser WITH PASSWORD 'SENHA_FORTE';
CREATE DATABASE app_db OWNER appuser;
GRANT ALL PRIVILEGES ON DATABASE app_db TO appuser;
```

Se quiser permitir acesso local do app em localhost, use normalmente a conexão:

```env
DATABASE_URL=postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db
```

> Em produção, evite dar privilégios excessivos. Para ambiente simples, o usuário `appuser` é suficiente.

## 4) Clonar o projeto no Windows Server

No diretório desejado:

```powershell
cd C:\
mkdir apps
cd apps

git clone https://github.com/SEU_USUARIO/SEU_REPO.git ponto-eletronico
cd ponto-eletronico
```

Se o repositório for privado, use SSH ou token.

## 5) Configurar variáveis de ambiente

Crie um arquivo `.env.production` na raiz do projeto:

```powershell
notepad .env.production
```

Conteúdo mínimo:

```env
DATABASE_URL=postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db
JWT_SECRET=troque-por-uma-chave-forte-e-aleatoria
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
```

Também é possível configurar as variáveis de ambiente no sistema do Windows:

```powershell
[Environment]::SetEnvironmentVariable("DATABASE_URL", "postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db", "User")
[Environment]::SetEnvironmentVariable("JWT_SECRET", "troque-por-uma-chave-forte-e-aleatoria", "User")
[Environment]::SetEnvironmentVariable("JWT_EXPIRES_IN", "24h", "User")
[Environment]::SetEnvironmentVariable("PORT", "3000", "User")
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "User")
```

Feche e abra o terminal depois.

## 6) Instalar dependências do projeto

```powershell
cd C:\apps\ponto-eletronico
npm install
```

## 7) Preparar o banco com Drizzle

```powershell
npx drizzle-kit push
```

Se quiser popular dados de exemplo:

```powershell
npm run db:seed
```

## 8) Build de produção

```powershell
npm run build
```

Se o build falhar, verifique:

```powershell
node -v
npm -v
npm run typecheck
```

## 9) Rodar em produção no Windows Server

### Opção 1: iniciar diretamente no terminal

```powershell
cd C:\apps\ponto-eletronico
npm run start -- --hostname 0.0.0.0 --port 3000
```

Use isso apenas para teste inicial ou para diagnóstico.

### Opção 2: rodar como serviço do Windows com NSSM

A forma mais segura e estável em Windows Server é criar um serviço para o app.

#### 9.1. Instalar o NSSM

Baixe o NSSM em https://nssm.cc/

Ou use uma instalação simples no Windows.

#### 9.2. Criar o script de inicialização

Crie um arquivo `start-ponto.ps1` na pasta do projeto:

```powershell
$env:NODE_ENV = "production"
$env:PORT = "3000"
Set-Location "C:\apps\ponto-eletronico"
npm run start -- --hostname 0.0.0.0 --port 3000
```

#### 9.3. Registrar o serviço

```powershell
nssm install PontoEletronico "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
nssm set PontoEletronico AppParameters "-ExecutionPolicy Bypass -File C:\apps\ponto-eletronico\start-ponto.ps1"
nssm set PontoEletronico AppDirectory "C:\apps\ponto-eletronico"
nssm set PontoEletronico Start SERVICE_AUTO_START
nssm start PontoEletronico
```

#### 9.4. Verificar o serviço

```powershell
Get-Service PontoEletronico
```

Teste local do app:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3000
```

### Opção 3: serviço com `sc.exe`

Se preferir, você também pode usar o `sc.exe`:

```powershell
sc.exe create "PontoEletronico" binPath= "C:\Program Files\nodejs\node.exe C:\apps\ponto-eletronico\node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000" start= auto
```

Depois:

```powershell
sc.exe start PontoEletronico
```

## 10) Proxy reverso com Nginx no Windows Server

Se quiser expor a aplicação via domínio e HTTPS, use Nginx ou IIS.

### Exemplo com Nginx

```nginx
server {
    listen 80;
    server_name ponto.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### HTTPS

No Windows, o mais comum é usar:

- Nginx com certificado do Let's Encrypt
- IIS com certificado do servidor
- Cloudflare + certificado externo
- Win ACME para gerar o certificado automaticamente

## 11) Verificação final

Teste a aplicação localmente:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3000
```

Ou usando o domínio:

```powershell
Invoke-WebRequest -Uri https://ponto.seudominio.com
```

## 12) Credenciais de acesso padrão

No seed do projeto, existem contas de demonstração:

- João: `joao@demo.com` / `123456`
- Maria: `maria@demo.com` / `123456`

A conta de RH/admin pode ser criada com perfil `rh` ou `admin` no banco ou via rotina administrativa do sistema.

## 13) Troubleshooting

### PostgreSQL não conecta

Verifique se o serviço do PostgreSQL está rodando e se a string de conexão está correta:

```powershell
Test-NetConnection 127.0.0.1 -Port 5432
```

### Build falha

```powershell
npm install
npm run build
```

### App não sobe

Verifique o serviço:

```powershell
Get-Service PontoEletronico
```

E os logs do PowerShell ou do serviço.

## 14) Checklist de deploy no Windows Server

- [ ] GitHub com o código atualizado
- [ ] Windows Server com Node.js 22 instalado
- [ ] PostgreSQL 16 instalado e banco criado
- [ ] Variáveis de ambiente configuradas
- [ ] `npm install` concluído
- [ ] `npx drizzle-kit push` executado
- [ ] `npm run build` concluído
- [ ] Serviço do Windows criado
- [ ] Aplicação respondendo em `http://127.0.0.1:3000`
- [ ] Proxy reverso e HTTPS configurados
- [ ] Segurança e firewall ajustados

## 15) Observações importantes

- A aplicação usa autenticação JWT; mantenha `JWT_SECRET` forte.
- Em produção, nunca deixe a chave em texto simples e sem controle de acesso.
- Use firewall, HTTPS e backups periódicos do PostgreSQL.
- Para ambiente corporativo, configure monitoramento e alertas do serviço do Windows.

## 16) Observação final

Este projeto usa PostgreSQL com Drizzle ORM e autenticação JWT. A app também possui comportamento offline com sincronização de pendências no navegador.

## 17) Appendix: Linux apenas como alternativa opcional

Se por algum motivo você quiser rodar em Linux, o processo é o mesmo em essência: instalação do Node.js, PostgreSQL, `.env`, `npm install`, `npx drizzle-kit push`, `npm run build`, e execução com PM2 ou Nginx. Mas para este projeto, a implantação correta e oficial neste documento é no Windows Server.
