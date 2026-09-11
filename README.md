# README de Deploy no VPS — Ponto Eletrônico

Este guia cobre a sequência completa desde a subida do código para o GitHub até a preparação do VPS, clonagem, instalação, configuração do banco, build e execução em produção do sistema de ponto eletrônico.

## 1) Requisitos do VPS

Recomendado:

- Ubuntu 22.04 LTS ou 24.04 LTS
- 2 vCPUs e 4 GB RAM mínimo
- acesso SSH root ou usuário sudo
- PostgreSQL 16
- Node.js 22 LTS
- Nginx (opcional, para proxy reverso)
- Certificado HTTPS (Let's Encrypt ou Cloudflare)

## 2) Preparar o repositório no GitHub

### 2.1. Subir o projeto para o GitHub

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

## 3) Acessar o VPS via SSH

```bash
ssh usuario@IP_DO_VPS
```

Se estiver usando root:

```bash
sudo -i
```

## 4) Instalar dependências no VPS

### 4.1. Atualizar sistema

```bash
apt update && apt upgrade -y
```

### 4.2. Instalar Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
```

Verifique:

```bash
node -v
npm -v
```

### 4.3. Instalar PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### 4.4. Instalar Nginx (opcional, mas recomendado)

```bash
apt install -y nginx
```

## 5) Configurar PostgreSQL no VPS

### 5.1. Criar usuário e banco

Entre como postgres:

```bash
sudo -u postgres psql
```

Dentro do psql:

```sql
CREATE USER appuser WITH PASSWORD 'SENHA_FORTE';
CREATE DATABASE app_db OWNER appuser;
ALTER USER appuser WITH SUPERUSER;
\q
```

> Em produção, evite SUPERUSER; se quiser uma configuração mais segura, use um papel mínimo necessário.

## 6) Clonar o projeto no VPS

```bash
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPO.git ponto-eletronico
cd ponto-eletronico
```

Se precisar clonar via SSH:

```bash
git clone git@github.com:SEU_USUARIO/SEU_REPO.git ponto-eletronico
```

## 7) Configurar variáveis de ambiente

Crie o arquivo `.env.production` ou `.env.local` na raiz do projeto:

```bash
nano .env.production
```

Conteúdo mínimo:

```env
DATABASE_URL=postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db
JWT_SECRET=troque-por-uma-chave-forte-e-aleatoria
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
```

Pode ser usado também `.env.local` para desenvolvimento local; para produção em VPS, recomenda-se `.env.production` e exportar esta variável no processo do serviço.

## 8) Instalar dependências do projeto

```bash
npm install
```

## 9) Preparar o banco com Drizzle

```bash
npx drizzle-kit push
```

Se quiser popular dados de exemplo:

```bash
npm run db:seed
```

## 10) Build de produção

```bash
npm run build
```

Se o build falhar, verifique:

```bash
node -v
npm -v
npm run typecheck
```

## 11) Iniciar em produção

### Opção 1: rodar diretamente

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
```

### Opção 2: manter em background com PM2

```bash
npm install -g pm2
pm2 start "npm run start -- --hostname 0.0.0.0 --port 3000" --name ponto-eletronico
pm2 save
pm2 startup
```

### Opção 3: rodar como serviço no Windows Server

No Windows Server, a forma mais segura é criar um serviço do Windows para rodar o app em background e reiniciar automaticamente.

#### 3.1. Instalar o Node.js no Windows Server

Baixe e instale o Node.js 22 LTS e confirme:

```powershell
node -v
npm -v
```

#### 3.2. Instalar dependências do projeto

No diretório da aplicação:

```powershell
cd C:\caminho\para\ponto-eletronico
npm install
```

#### 3.3. Configurar variáveis de ambiente no Windows

Crie um arquivo `.env.production` na raiz do projeto, ou configure as variáveis em ambiente do sistema:

```powershell
$env:DATABASE_URL="postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db"
$env:JWT_SECRET="troque-por-uma-chave-forte-e-aleatoria"
$env:JWT_EXPIRES_IN="24h"
$env:PORT="3000"
$env:NODE_ENV="production"
```

Para deixar persistente no Windows:

```powershell
[Environment]::SetEnvironmentVariable("DATABASE_URL", "postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db", "User")
[Environment]::SetEnvironmentVariable("JWT_SECRET", "troque-por-uma-chave-forte-e-aleatoria", "User")
[Environment]::SetEnvironmentVariable("JWT_EXPIRES_IN", "24h", "User")
[Environment]::SetEnvironmentVariable("PORT", "3000", "User")
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "User")
```

Reinicie o terminal após isso.

#### 3.4. Criar o build de produção

```powershell
npm run build
```

#### 3.5. Criar o serviço do Windows

Opcionalmente, você pode usar o `sc.exe` para criar um serviço do Windows.

```powershell
sc.exe create "PontoEletronico" binPath= "C:\Program Files\nodejs\node.exe C:\caminho\para\ponto-eletronico\node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000" start= auto
```

Se preferir usar um script do PowerShell para subir o app como serviço, também pode criar um arquivo `start-ponto.ps1`:

```powershell
$env:NODE_ENV = "production"
$env:PORT = "3000"
Set-Location "C:\caminho\para\ponto-eletronico"
npm run start -- --hostname 0.0.0.0 --port 3000
```

Depois use o NSSM (serviço de serviço) para registrar esse script:

```powershell
nssm install PontoEletronico "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
nssm set PontoEletronico AppParameters "-ExecutionPolicy Bypass -File C:\caminho\para\ponto-eletronico\start-ponto.ps1"
nssm set PontoEletronico AppDirectory "C:\caminho\para\ponto-eletronico"
nssm set PontoEletronico Start SERVICE_AUTO_START
nssm start PontoEletronico
```

#### 3.6. Verificar serviço

```powershell
Get-Service PontoEletronico
```

Se estiver em execução:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3000
```

#### 3.7. Se quiser usar Nginx no Windows Server

Também é possível usar IIS ou Nginx em frente ao app para proxy reverso e HTTPS.

Exemplo rápido de Nginx:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Opção 4: usar o processo do sistema com Nginx

Configure o Nginx para proxy reverso para `http://127.0.0.1:3000`:

```bash
sudo nano /etc/nginx/sites-available/ponto-eletronico
```

Exemplo:

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

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

Ative o site:

```bash
ln -s /etc/nginx/sites-available/ponto-eletronico /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 12) HTTPS com Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 13) Verificação final

Teste a aplicação:

```bash
curl -I http://127.0.0.1:3000
```

Ou usando o domínio:

```bash
curl -I https://seu-dominio.com
```

## 14) Credenciais de acesso padrão

No seed do projeto, existem contas de demonstração:

- João: `joao@demo.com` / `123456`
- Maria: `maria@demo.com` / `123456`

A conta de RH/admin pode ser criada com perfil `rh` ou `admin` no banco ou via rotina administrativa do sistema.

## 15) Troubleshooting

### PostgreSQL não conecta

Verifique:

```bash
sudo -u postgres psql -l
```

Confirme se o `DATABASE_URL` está correto e se o banco existe.

### Build falha

```bash
npm install
npm run build
```

### App não sobe

```bash
pm2 logs ponto-eletronico
```

ou:

```bash
journalctl -u nginx -n 50
```

## 16) Checklist de deploy

- [ ] GitHub com o código atualizado
- [ ] VPS acessível por SSH
- [ ] Node.js 22 instalado
- [ ] PostgreSQL instalado e banco criado
- [ ] Variáveis de ambiente configuradas
- [ ] `npm install` concluído
- [ ] `npx drizzle-kit push` executado
- [ ] `npm run build` concluído
- [ ] `pm2` ou Nginx configurado
- [ ] HTTPS ativo
- [ ] Aplicação respondendo no domínio/IP

## 17) Observações importantes

- A aplicação usa autenticação JWT; mantenha `JWT_SECRET` forte.
- O VPS deve ficar atrás de Nginx ou proxy reverso para produção.
- Use Firewall e HTTPS em ambiente real.
- Para ambientes corporativos, mantenha backups do banco PostgreSQL e configure monitoração.


## Observações

Este projeto usa PostgreSQL com Drizzle ORM e uma camada de autenticação com JWT. A aplicação também possui comportamento offline com sincronização de pendências no navegador.
