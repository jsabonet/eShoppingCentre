#!/bin/bash
# ──────────────────────────────────────────────
# eShoppingCentre — Deploy Script
# Executar no Droplet: bash deploy.sh
# ──────────────────────────────────────────────

set -e

echo "🚀 eShoppingCentre — Deploy iniciado"

# ─── 1. Pull latest code ───
echo "📦 A obter código mais recente..."
cd /app/eShoppingCentre
git pull origin main

# ─── 2. Copy production .env ───
if [ ! -f .env ]; then
    echo "⚠️  .env não encontrado. Copia .env.production.example para .env e configura."
    exit 1
fi

# ─── 3. Copy Firebase credentials ───
if [ ! -f backend/credentials/firebase-adminsdk.json ]; then
    echo "⚠️  Credenciais Firebase não encontradas em backend/credentials/"
    exit 1
fi

# ─── 4. Build & start containers ───
echo "🏗️  A construir imagens Docker..."
docker compose -f docker-compose.prod.yml build --pull

echo "🔄 A reiniciar serviços..."
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d

# ─── 5. Run migrations ───
echo "🗄️  A aplicar migrações..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput

# ─── 6. Collect static ───
echo "📁 A recolher ficheiros estáticos..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# ─── 7. Clean up old images ───
echo "🧹 A limpar imagens antigas..."
docker image prune -af

echo "✅ Deploy concluído!"
docker compose -f docker-compose.prod.yml ps
