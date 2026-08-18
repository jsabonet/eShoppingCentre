#!/bin/bash
# ──────────────────────────────────────────────
# eShoppingCentre — Backend Entrypoint
# Corre permissões de diretórios graváveis e
# desce para o utilizador 'django'.
# ──────────────────────────────────────────────
set -e

echo "🔧 A corrigir permissões dos diretórios graváveis..."

# Media (named volume partilhado com nginx)
mkdir -p /app/media
chown -R django:django /app/media 2>/dev/null || true

# Home do utilizador django
mkdir -p /home/django
chown -R django:django /home/django 2>/dev/null || true

# Garantir que o HOME aponta para o diretório do utilizador django
# (o gunicorn cria ~/.gunicorn para o control server)
export HOME=/home/django
export XDG_RUNTIME_DIR=/tmp

echo "✅ Permissões corrigidas. A iniciar como django..."

# Desce de privilégio e executa o CMD como django
if command -v setpriv >/dev/null 2>&1; then
  exec setpriv --reuid=django --regid=django --init-groups -- "$@"
elif command -v runuser >/dev/null 2>&1; then
  exec runuser -u django -- "$@"
elif command -v su-exec >/dev/null 2>&1; then
  exec su-exec django "$@"
else
  echo "⚠️  Nenhum comando para mudar de user. A correr como root."
  exec "$@"
fi
