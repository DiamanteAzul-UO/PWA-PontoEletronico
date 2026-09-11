# README de Deploy no VPS — Ponto Eletrônico

Este guia cobre a sequência completa desde a subida do código para o GitHub até a preparação do servidor, clonagem, instalação, configuração do banco, build e execução em produção do sistema de ponto eletrônico — com instruções para **Linux (VPS Ubuntu)** e **Windows Server**.

---

## 1) Requisitos do servidor

### Linux (VPS)

- Ubuntu 22.04 LTS ou 24.04 LTS
- 2 vCPUs e 4 GB RAM mínimo
- Acesso SSH root ou usuário sudo
- PostgreSQL 16
- Node.js 22 LTS
- Nginx (opcional, para proxy reverso)
- Certificado HTTPS (Let's Encrypt ou Cloudflare)

### Windows Server

- Windows Server 2019 ou 2022
- 2 vCPUs e 4 GB RAM mínimo
- Acesso via RDP (Área de Trabalho Remota) com permissão de administrador
- PostgreSQL 16 para Windows
- Node.js 22 LTS para Windows
- IIS (com módulo URL Rewrite + Application Request Routing) **ou** Nginx para Windows, como proxy reverso
- Certificado HTTPS (win-acme para Let's Encrypt, ou certificado próprio/Cloudflare)

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

---

## 3) Acessar o servidor

### Linux — via SSH

```bash
ssh usuario@IP_DO_VPS
```

Se estiver usando root:

```bash
sudo -i
```

### Windows Server — via RDP

1. Abra o **Conexão de Área de Trabalho Remota** (`mstsc`) no seu computador
2. Informe o IP do servidor, usuário e senha de administrador
3. Todos os comandos abaixo (Windows) são executados no **PowerShell como Administrador**

---

## 4) Instalar dependências no servidor

### 4.1. Linux — Atualizar sistema

```bash
apt update && apt upgrade -y
```

### 4.2. Linux — Instalar Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
```

Verifique:

```bash
node -v
npm -v
```

### 4.3. Linux — Instalar PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### 4.4. Linux — Instalar Nginx (opcional, mas recomendado)

```bash
apt install -y nginx
```

---

### 4.5. Windows Server — Instalar o Chocolatey (gerenciador de pacotes)

Facilita a instalação de tudo abaixo. No PowerShell como Administrador:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 4.6. Windows Server — Instalar Node.js 22

```powershell
choco install nodejs-lts --version=22 -y
```

Ou baixe o instalador MSI diretamente em https://nodejs.org/ (versão 22 LTS) e execute-o.

Verifique (feche e reabra o PowerShell antes):

```powershell
node -v
npm -v
```

### 4.7. Windows Server — Instalar Git

```powershell
choco install git -y
```

### 4.8. Windows Server — Instalar PostgreSQL

```powershell
choco install postgresql16 --params '/Password:SENHA_FORTE' -y
```

Isso instala o PostgreSQL 16 já com o usuário `postgres` configurado com a senha informada, e adiciona `psql` ao PATH.

### 4.9. Windows Server — Instalar IIS (proxy reverso) — opcional

Via PowerShell:

```powershell
Install-WindowsFeature -Name Web-Server,Web-Http-Redirect,Web-Filtering -IncludeManagementTools
```

Depois instale os módulos **URL Rewrite** e **Application Request Routing (ARR)**:

- URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite
- ARR: https://www.iis.net/downloads/microsoft/application-request-routing

> Alternativa mais simples: usar **Nginx para Windows** (baixar em https://nginx.org/en/download.html) em vez do IIS — configuração muito parecida com a do Linux.

---

## 5) Configurar PostgreSQL

### 5.1. Linux — Criar usuário e banco

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

### 5.2. Windows Server — Criar usuário e banco

Abra o `psql` (via Menu Iniciar → PostgreSQL 16 → SQL Shell, ou no PowerShell):

```powershell
psql -U postgres
```

Dentro do psql (mesmos comandos do Linux):

```sql
CREATE USER appuser WITH PASSWORD 'SENHA_FORTE';
CREATE DATABASE app_db OWNER appuser;
ALTER USER appuser WITH SUPERUSER;
\q
```

> Assim como no Linux, evite `SUPERUSER` em produção — prefira um papel com apenas os privilégios necessários no `app_db`.

---

## 6) Clonar o projeto

### Linux

```bash
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPO.git ponto-eletronico
cd ponto-eletronico
```

Se precisar clonar via SSH:

```bash
git clone git@github.com:SEU_USUARIO/SEU_REPO.git ponto-eletronico
```

### Windows Server

```powershell
New-Item -Path "C:\www" -ItemType Directory -Force
Set-Location "C:\www"
git clone https://github.com/SEU_USUARIO/SEU_REPO.git ponto-eletronico
Set-Location "C:\www\ponto-eletronico"
```

---

## 7) Configurar variáveis de ambiente

### Linux

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

### Windows Server

Crie o arquivo `.env.production` na raiz do projeto (pode usar Notepad ou PowerShell):

```powershell
New-Item -Path ".\.env.production" -ItemType File -Force
notepad .env.production
```

Mesmo conteúdo mínimo:

```env
DATABASE_URL=postgresql://appuser:SENHA_FORTE@127.0.0.1:5432/app_db
JWT_SECRET=troque-por-uma-chave-forte-e-aleatoria
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=production
```

> Alternativa: definir como variáveis de ambiente do sistema Windows (`setx DATABASE_URL "..." /M`), úteis se for rodar como Serviço do Windows via NSSM (seção 11).

---

## 8) Instalar dependências do projeto

### Linux

```bash
npm install
```

### Windows Server

```powershell
npm install
```

---

## 9) Preparar o banco com Drizzle

Igual em ambos os sistemas:

```bash
npx drizzle-kit push
```

Se quiser popular dados de exemplo:

```bash
npm run db:seed
```

---

## 10) Build de produção

Igual em ambos os sistemas:

```bash
npm run build
```

Se o build falhar, verifique:

```bash
node -v
npm -v
npm run typecheck
```

---

## 11) Iniciar em produção

### Linux

**Opção 1: rodar diretamente**

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
```

**Opção 2: manter em background com PM2**

```bash
npm install -g pm2
pm2 start "npm run start -- --hostname 0.0.0.0 --port 3000" --name ponto-eletronico
pm2 save
pm2 startup
```

**Opção 3: usar o processo do sistema com Nginx**

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

### Windows Server

**Opção 1: rodar diretamente (teste rápido)**

```powershell
npm run start -- --hostname 0.0.0.0 --port 3000
```

**Opção 2: manter rodando como Serviço do Windows com NSSM (recomendado)**

O NSSM ("Non-Sucking Service Manager") transforma o processo Node em um serviço nativo do Windows, com reinício automático.

```powershell
choco install nssm -y

nssm install PontoEletronico "C:\Program Files\nodejs\npm.cmd" "run start -- --hostname 0.0.0.0 --port 3000"
nssm set PontoEletronico AppDirectory "C:\www\ponto-eletronico"
nssm set PontoEletronico AppEnvironmentExtra NODE_ENV=production
nssm start PontoEletronico
```

Para gerenciar depois:

```powershell
nssm status PontoEletronico
nssm restart PontoEletronico
nssm stop PontoEletronico
```

**Opção 3: PM2 no Windows**

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
pm2 start "npm run start -- --hostname 0.0.0.0 --port 3000" --name ponto-eletronico
pm2 save
```

**Opção 4: proxy reverso com IIS**

Com IIS + URL Rewrite + ARR instalados (seção 4.9), crie um `web.config` na raiz do site apontado pelo IIS, redirecionando para `http://127.0.0.1:3000`:

```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

No Gerenciador do IIS, crie um site novo apontando para a pasta desse `web.config`, com o binding na porta 80 (e depois 443, após configurar o certificado).

> Alternativa mais simples que IIS: instalar **Nginx para Windows** e usar uma configuração quase idêntica à do Linux (seção 11, Linux, Opção 3).

---

## 12) HTTPS

### Linux — Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

### Windows Server — Let's Encrypt com win-acme

1. Baixe o **win-acme** em https://www.win-acme.com/
2. Extraia em uma pasta (ex: `C:\win-acme`)
3. Execute como Administrador:

```powershell
cd C:\win-acme
.\wacs.exe
```

4. Siga o menu interativo: escolha o site no IIS (ou a opção manual, se estiver usando Nginx/NSSM sem IIS) e o domínio
5. O win-acme instala o certificado e pode configurar renovação automática via Agendador de Tarefas

> Se estiver usando Nginx para Windows em vez de IIS, escolha no win-acme a opção de validação manual/standalone e depois aponte o certificado gerado (`.pfx`/`.pem`) na configuração do Nginx, de forma semelhante ao Linux.

---

## 13) Verificação final

Teste a aplicação:

**Linux**

```bash
curl -I http://127.0.0.1:3000
```

**Windows Server**

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3000 -UseBasicParsing | Select-Object StatusCode
```

Ou usando o domínio (ambos os sistemas):

```bash
curl -I https://seu-dominio.com
```

---

## 14) Credenciais de acesso padrão

No seed do projeto, existem contas de demonstração:

- João: `joao@demo.com` / `123456`
- Maria: `maria@demo.com` / `123456`

A conta de RH/admin pode ser criada com perfil `rh` ou `admin` no banco ou via rotina administrativa do sistema.

---

## 15) Troubleshooting

### PostgreSQL não conecta

**Linux**

```bash
sudo -u postgres psql -l
```

**Windows Server**

```powershell
psql -U postgres -l
```

Em ambos: confirme se o `DATABASE_URL` está correto e se o banco existe.

### Build falha

```bash
npm install
npm run build
```

### App não sobe

**Linux**

```bash
pm2 logs ponto-eletronico
```

ou:

```bash
journalctl -u nginx -n 50
```

**Windows Server**

```powershell
nssm status PontoEletronico
```

Logs do NSSM (se configurados) ficam em `stdout.log`/`stderr.log` na pasta definida com:

```powershell
nssm set PontoEletronico AppStdout "C:\www\ponto-eletronico\logs\stdout.log"
nssm set PontoEletronico AppStderr "C:\www\ponto-eletronico\logs\stderr.log"
```

Se estiver com PM2:

```powershell
pm2 logs ponto-eletronico
```

Se estiver com IIS, verifique o **Visualizador de Eventos do Windows** (Event Viewer) e os logs do IIS em `C:\inetpub\logs\LogFiles`.

### Firewall bloqueando acesso (Windows Server)

Libere as portas necessárias:

```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

> Não abra a porta 3000 (do Node) diretamente para a internet — mantenha-a acessível só localmente (`127.0.0.1`), com o IIS/Nginx fazendo o proxy nas portas 80/443.

---

## 16) Checklist de deploy

- [ ] GitHub com o código atualizado
- [ ] Servidor acessível (SSH no Linux / RDP no Windows)
- [ ] Node.js 22 instalado
- [ ] PostgreSQL instalado e banco criado
- [ ] Variáveis de ambiente configuradas
- [ ] `npm install` concluído
- [ ] `npx drizzle-kit push` executado
- [ ] `npm run build` concluído
- [ ] Processo em produção configurado (PM2 / NSSM / systemd)
- [ ] Proxy reverso configurado (Nginx / IIS)
- [ ] HTTPS ativo (Certbot / win-acme)
- [ ] Firewall configurado
- [ ] Aplicação respondendo no domínio/IP

---

## 17) Observações importantes

- A aplicação usa autenticação JWT; mantenha `JWT_SECRET` forte.
- O servidor deve ficar atrás de um proxy reverso (Nginx ou IIS) em produção.
- Use Firewall e HTTPS em ambiente real, tanto no Linux quanto no Windows Server.
- Para ambientes corporativos, mantenha backups do banco PostgreSQL e configure monitoração.
- No Windows Server, prefira rodar a aplicação como **Serviço do Windows** (via NSSM) em vez de manter uma janela de terminal aberta — isso garante reinício automático em caso de queda ou reboot do servidor.

## Observações

Este projeto usa PostgreSQL com Drizzle ORM e uma camada de autenticação com JWT. A aplicação também possui comportamento offline com sincronização de pendências no navegador.
