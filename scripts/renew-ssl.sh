#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# eShoppingCentre — Renovação do certificado SSL (Let's Encrypt)
#
# Uso:
#   sudo bash scripts/renew-ssl.sh          # renova só se necessário
#   sudo bash scripts/renew-ssl.sh --force  # força a renovação
#
# O certificado é obtido via HTTP-01 (--standalone), por isso o
# nginx é parado temporariamente para libertar a porta 80.
# Depois de renovar, os ficheiros são copiados para ./nginx/ssl/
# (o diretório montado no container nginx) e o nginx é reiniciado.
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# Diretório do projecto (sobrescreve com: PROJECT_DIR=/outro/caminho bash scripts/renew-ssl.sh)
PROJECT_DIR="${PROJECT_DIR:-/app/eShoppingCentre}"

DOMAIN="${DOMAIN:-e-shoppingcentre.com}"
LETSENCRYPT_LIVE="/etc/letsencrypt/live/${DOMAIN}"
SSL_DIR="${PROJECT_DIR}/nginx/ssl"

FORCE_RENEWAL=""
if [[ "${1:-}" == "--force" ]]; then
    FORCE_RENEWAL="--force-renewal"
fi

cd "${PROJECT_DIR}"

echo "🔐 eShoppingCentre — renovação SSL"
echo "   Projecto: ${PROJECT_DIR}"
echo "   Domínio : ${DOMAIN}"

# 1. Parar o nginx (liberta a porta 80 para o HTTP-01 standalone)
echo "⏸️  A parar o nginx..."
if docker compose ps -q nginx >/dev/null 2>&1; then
    docker compose stop nginx
else
    echo "   (nginx já estava parado)"
fi

# 2. Renovar o certificado
echo "🔄 A renovar o certificado com certbot..."
# shellcheck disable=SC2086
certbot renew ${FORCE_RENEWAL} --quiet \
    --preferred-challenges http \
    --no-random-sleep-on-renew

# 3. Copiar os certificados renovados para o nginx
echo "📁 A copiar certificados para ${SSL_DIR}..."
if [[ ! -f "${LETSENCRYPT_LIVE}/fullchain.pem" ]]; then
    echo "❌ Certificado não encontrado em ${LETSENCRYPT_LIVE}" >&2
    docker compose start nginx
    exit 1
fi

mkdir -p "${SSL_DIR}"
cp "${LETSENCRYPT_LIVE}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
cp "${LETSENCRYPT_LIVE}/privkey.pem"  "${SSL_DIR}/privkey.pem"
chmod 600 "${SSL_DIR}/privkey.pem"

# 4. Subir o nginx
echo "▶️  A reiniciar o nginx..."
docker compose up -d nginx

# 5. Verificar a validade do certificado
echo "✅ Verificação:"
openssl x509 -in "${SSL_DIR}/fullchain.pem" -noout -subject -dates 2>/dev/null \
    || echo "   (openssl indisponível — valida manualmente com: curl -vIs https://${DOMAIN}/)"

echo "✅ Renovação concluída."
