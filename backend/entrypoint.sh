#!/bin/bash
# ──────────────────────────────────────────────
# eShoppingCentre — Backend Entrypoint
# Corre permissões de diretórios graváveis (named volumes
# só herdam a ownership da imagem na PRIMEIRA criação).
# Depois desce para o utilizador 'django' e executa o comando.
# ──────────────────────────────────────────────
set -e

echo "🔧 A corrigir permissões dos diretórios graváveis..."

# Media (named volume partilhado com nginx)
mkdir -p /app/media
chown -R django:django /app/media 2>/dev/null || true

# Home do utilizador django (o control server do gunicorn precisa de gravar)
mkdir -p /home/django
chown -R django:django /home/django 2>/dev/null || true

echo "✅ Permissões corrigidas. A iniciar como django..."

# Desce de privilégio e executa o comando (CMD) como django
if command -v setpriv >/dev/null 2>&1; then
  exec setpriv --reuid=django --regid=django --init-groups "$@"
else
  exec su -s /bin/bash django -c "exec $*"
fi
