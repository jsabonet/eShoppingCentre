# 🚀 eShoppingCentre — Guia Completo de Deploy

> **Digital Ocean + Docker + Nginx + PostgreSQL + Redis + Celery**
>
> Versão: 1.0 | Última atualização: Julho 2026

---

## 📋 Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar Droplet na Digital Ocean](#2-criar-droplet-na-digital-ocean)
3. [Configurar DNS](#3-configurar-dns)
4. [Setup Inicial do Servidor](#4-setup-inicial-do-servidor)
5. [Clonar o Projecto e Configurar](#5-clonar-o-projecto-e-configurar)
6. [Variáveis de Ambiente (.env)](#6-variáveis-de-ambiente-env)
7. [Firebase — Produção](#7-firebase--produção)
8. [Storage de Media — Digital Ocean Spaces](#8-storage-de-media--digital-ocean-spaces)
9. [SSL — Certificado HTTPS](#9-ssl--certificado-https)
10. [Primeiro Deploy](#10-primeiro-deploy)
11. [Criar Superusuário Admin](#11-criar-superusuário-admin)
12. [Backups](#12-backups)
13. [Monitorização](#13-monitorização)
14. [Deploys Futuros](#14-deploys-futuros)
15. [Troubleshooting](#15-troubleshooting)
16. [Escalabilidade](#16-escalabilidade)

---

## 1. Pré-requisitos

Antes de começar, precisas de:

| Item | Onde obter | Custo |
|------|-----------|-------|
| Conta Digital Ocean | [digitalocean.com](https://digitalocean.com) | Pay-as-you-go |
| Domínio (.co.mz) | [TVCabo](https://www.tvcabo.co.mz) / [CIUEM](https://www.ciuem.mz) | ~2000 MZN/ano |
| Conta Firebase | [console.firebase.google.com](https://console.firebase.google.com) | Grátis (Spark) |
| Chave SSH | Gerada no teu computador | Grátis |
| Git | [github.com](https://github.com) | Grátis |

### Gerar chave SSH

```bash
# No teu computador
ssh-keygen -t ed25519 -C "teu-email@exemplo.com"
cat ~/.ssh/id_ed25519.pub   # copiar output
```

---

## 2. Criar Droplet na Digital Ocean

1. Entra em [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Clica em **"Create"** → **"Droplets"**

### Configuração

| Campo | Valor |
|-------|-------|
| **Region** | Frankfurt `fra1` (~160ms para Maputo) |
| **Image** | Ubuntu 24.04 (LTS) x64 |
| **Size** | ⭐ **4 vCPUs / 8 GB RAM / 160 GB SSD** ($96/mês) |
| **Auth** | SSH Key |
| **Hostname** | `eshoppingcentre` |
| **Monitoring** | ✅ |
| **Backups** | ✅ (+20%) |

### Opção económica (MVP)

| Campo | Valor |
|-------|-------|
| **Size** | 2 vCPUs / 4 GB RAM / 80 GB SSD ($48/mês) |

> 💡 Podes fazer **resize vertical** mais tarde sem perder dados.

---

## 3. Configurar DNS

No painel do teu domínio, adiciona estes registos:

| Tipo | Nome | Valor |
|------|------|-------|
| `A` | `@` | `<IP_DO_DROPLET>` |
| `A` | `www` | `<IP_DO_DROPLET>` |

Verificar propagação:

```bash
nslookup eshoppingcentre.co.mz
```

---

## 4. Setup Inicial do Servidor

```bash
ssh root@<IP_DO_DROPLET>
```

### 4.1 Actualizar e instalar dependências

```bash
apt update && apt upgrade -y
apt install -y git curl wget nano htop ufw
```

### 4.2 Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
usermod -aG docker $USER
```

### 4.3 Instalar Docker Compose

```bash
apt install docker-compose-plugin -y
docker compose version
```

### 4.4 Configurar Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

### 4.5 Criar estrutura de pastas

```bash
mkdir -p /app/eShoppingCentre
mkdir -p /app/backups
mkdir -p /app/nginx/ssl
```

---

## 5. Clonar o Projecto e Configurar

```bash
cd /app
git clone https://github.com/jsabonet/eShoppingCentre.git
cd /app/eShoppingCentre
```

### 5.1 Criar .env

```bash
cp .env.production.example .env
nano .env   # preencher TODOS os valores
```

### 5.2 Upload das credenciais Firebase

```bash
mkdir -p /app/eShoppingCentre/backend/credentials

# Do teu computador:
scp firebase-adminsdk.json root@46.101.163.186:/app/eShoppingCentre/backend/credentials/
```

---

## 6. Variáveis de Ambiente (.env)

```bash
nano /app/eShoppingCentre/.env
```

### Valores obrigatórios

```env
# Domínio
DOMAIN=eshoppingcentre.com

# Django (gera com: openssl rand -base64 50)
SECRET_KEY=<CHAVE_ALEATORIA_50_CARACTERES>
DEBUG=False
ALLOWED_HOSTS=eshoppingcentre.co.mz,www.eshoppingcentre.co.mz

# Database
DB_NAME=eshoppingcentre
DB_USER=eshopping
DB_PASSWORD=<PASSWORD_FORTE>

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=credentials/firebase-adminsdk.json

# Digital Ocean Spaces (ver secção 8)
AWS_ACCESS_KEY_ID=DO00...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=eshoppingcentre-media
AWS_S3_REGION_NAME=ams3
AWS_S3_ENDPOINT_URL=https://ams3.digitaloceanspaces.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG....
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=noreply@eshoppingcentre.co.mz

# Frontend
FRONTEND_URL=https://eshoppingcentre.co.mz

# Firebase Client (copiar do Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBDT4Q4Lt2KFnmOsXbQev_as3GaeUPGdQk
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eshoppingcentre-1cc68.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eshoppingcentre-1cc68
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=eshoppingcentre-1cc68.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1017529752588
NEXT_PUBLIC_FIREBASE_APP_ID=1:1017529752588:web:fc57ffd6f0bbafc8fb6229
```

---

## 7. Firebase — Produção

### 7.1 Authorized Domains

1. [console.firebase.google.com](https://console.firebase.google.com)
2. Authentication → Settings → **Authorized domains**
3. Adiciona: `eshoppingcentre.co.mz`

### 7.2 Sign-in Method

Confirma que **Google** está activo em Authentication → Sign-in method.

---

## 8. Storage de Media — Digital Ocean Spaces

### 8.1 Criar Space

1. Digital Ocean Console → **Spaces** → **Create**
2. Região: **Amsterdam (`ams3`)**
3. Nome: `eshoppingcentre-media`
4. ✅ Enable CDN (opcional)

### 8.2 Criar API Keys

1. Console → **API** → **Tokens/Keys**
2. Generate New Key → nome: `eshoppingcentre-spaces`
3. Copiar **Key** e **Secret**

### 8.3 Preencher no .env

```env
AWS_ACCESS_KEY_ID=DO00...     ← Key
AWS_SECRET_ACCESS_KEY=...      ← Secret
AWS_STORAGE_BUCKET_NAME=eshoppingcentre-media
AWS_S3_REGION_NAME=ams3
AWS_S3_ENDPOINT_URL=https://ams3.digitaloceanspaces.com
```

---

## 9. SSL — Certificado HTTPS

### 9.1 Instalar e obter certificado

```bash
apt install certbot -y

# Parar nginx se estiver a correr
docker compose -f /app/eShoppingCentre/docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obter certificado
certbot certonly --standalone \
  -d eshoppingcentre.co.mz \
  -d www.eshoppingcentre.co.mz \
  --email teu-email@exemplo.com \
  --agree-tos --non-interactive

# Copiar para nginx
cp /etc/letsencrypt/live/eshoppingcentre.co.mz/fullchain.pem /app/eShoppingCentre/nginx/ssl/
cp /etc/letsencrypt/live/eshoppingcentre.co.mz/privkey.pem /app/eShoppingCentre/nginx/ssl/
```

### 9.2 Renovação automática

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /app/eShoppingCentre && docker compose -f docker-compose.prod.yml restart nginx'") | crontab -
```

---

## 10. Primeiro Deploy

```bash
cd /app/eShoppingCentre
chmod +x deploy.sh
./deploy.sh
```

O script faz: build → inicia containers → migrações → collectstatic → limpeza.

### Verificar

```bash
docker compose -f docker-compose.prod.yml ps
# Todos os 7 serviços devem estar "Up"

docker compose -f docker-compose.prod.yml logs --tail=50
```

Abre `https://eshoppingcentre.co.mz` no browser.

---

## 11. Criar Superusuário Admin

```bash
cd /app/eShoppingCentre
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
# Email: admin@eshoppingcentre.co.mz
# Username: admin
# Password: <forte>
```

### Tornar admin no frontend

1. Acede a `https://eshoppingcentre.co.mz/admin/` (Django Admin)
2. Users → clica no teu user
3. Roles: `["buyer", "admin"]`
4. ✅ Staff status + Superuser status
5. Guarda

Agora podes aceder ao painel Next.js em `https://eshoppingcentre.co.mz/admin`.

---

## 12. Backups

### Backup diário da DB

```bash
nano /app/backups/backup-db.sh
```

```bash
#!/bin/bash
cd /app/eShoppingCentre
DATE=$(date +%Y%m%d_%H%M%S)
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U eshopping eshoppingcentre > "/app/backups/db_$DATE.sql"
gzip "/app/backups/db_$DATE.sql"
find /app/backups -name "db_*.sql.gz" -mtime +7 -delete
echo "Backup: db_$DATE.sql.gz"
```

```bash
chmod +x /app/backups/backup-db.sh

# Agendar (todos os dias às 2h)
(crontab -l 2>/dev/null; echo "0 2 * * * /app/backups/backup-db.sh >> /app/backups/backup.log 2>&1") | crontab -
```

### Restaurar

```bash
gunzip /app/backups/db_20260725_020000.sql.gz
docker compose -f docker-compose.prod.yml exec -T db psql -U eshopping eshoppingcentre < /app/backups/db_20260725_020000.sql
```

---

## 13. Monitorização

```bash
# Estado dos containers
docker compose -f docker-compose.prod.yml ps

# Uso de recursos
docker stats --no-stream

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Logs de serviço específico
docker compose -f docker-compose.prod.yml logs -f backend

# Health check
curl -I https://eshoppingcentre.co.mz
curl https://eshoppingcentre.co.mz/api/v1/products/?page_size=1
```

Digital Ocean Dashboard → Monitoring → CPU, RAM, Disk, Network (grátis).

---

## 14. Deploys Futuros

### Deploy normal

```bash
ssh root@<IP>
cd /app/eShoppingCentre
git pull origin main
./deploy.sh
```

### Deploy sem downtime

```bash
cd /app/eShoppingCentre
git pull origin main
docker compose -f docker-compose.prod.yml build --pull backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker image prune -af
```

### Rollback

```bash
git log --oneline -5
git revert HEAD --no-edit
./deploy.sh
```

---

## 15. Troubleshooting

| Problema | Solução |
|----------|---------|
| **502 Bad Gateway** | `docker compose logs backend --tail=50` — verificar migrações, .env |
| **500 Internal Error** | `docker compose exec backend python manage.py check --deploy` |
| **Frontend 404** | `docker compose build --no-cache frontend && docker compose up -d frontend` |
| **SSL expirado** | `certbot renew --force-renewal` + copiar certs + restart nginx |
| **Disco cheio** | `docker system prune -af --volumes` |
| **Reiniciar tudo** | `docker compose down && docker compose up -d` |
| **Logs de um serviço** | `docker compose logs -f <servico>` |

---

## 16. Escalabilidade

### Droplet recomendado

| vCPUs | RAM | SSD | Preço | Quando |
|-------|-----|-----|-------|--------|
| 2 | 4 GB | 80 GB | ~$48/mês | MVP |
| ⭐ **4** | **8 GB** | **160 GB** | **~$96/mês** | **Produção** |
| 8 | 16 GB | 320 GB | ~$192/mês | Alto tráfego |

### Fases de crescimento

| Fase | Setup | Custo |
|------|-------|-------|
| 1 (agora) | Droplet único 4vCPU/8GB | ~$100/mês |
| 2 (> 10k/dia) | + Managed Database | ~$180/mês |
| 3 (> 50k/dia) | Load Balancer + 2+ Droplets + Managed Redis | ~$400/mês |

---

## ✅ Checklist Final

- [ ] Droplet criado (4 vCPU / 8 GB / fra1)
- [ ] DNS configurado
- [ ] Docker + Compose instalados
- [ ] Firewall activo (22, 80, 443)
- [ ] Projecto clonado
- [ ] `.env` preenchido
- [ ] `firebase-adminsdk.json` copiado
- [ ] Firebase domains autorizados
- [ ] Space criado para media
- [ ] SSL instalado + auto-renew
- [ ] `./deploy.sh` executado
- [ ] Superusuário criado
- [ ] Backup diário agendado
- [ ] Site online em `https://eshoppingcentre.co.mz`

---

> 💡 Guarda este ficheiro. Imprime a checklist e marca cada item.
