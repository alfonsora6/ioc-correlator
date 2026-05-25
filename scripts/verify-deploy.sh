#!/usr/bin/env bash
# Comprueba despliegue en Debian/Linux (API + registro de prueba)
set -euo pipefail

HOST="${1:-127.0.0.1}"
API="http://${HOST}:8000"
FRONT="http://${HOST}:5173"

ok() { echo "[verify] OK: $*"; }
fail() { echo "[verify] FALLO: $*" >&2; exit 1; }

echo "[verify] API: $API"
echo "[verify] Frontend: $FRONT"

curl -sf "${API}/health" | grep -q '"status"' || fail "GET /health"
ok "/health"

EMAIL="verify-$(date +%s)@test.local"
PASS="TestPass123!"

REG=$(curl -sf -w "\n%{http_code}" -X POST "${API}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"full_name\":\"Verify User\",\"tenant_name\":\"Verify Org\"}")

BODY=$(echo "$REG" | head -n -1)
CODE=$(echo "$REG" | tail -n 1)

[[ "$CODE" == "200" ]] || fail "POST /register HTTP $CODE — $BODY"
echo "$BODY" | grep -q 'access_token' || fail "register sin access_token — $BODY"
ok "registro (access_token recibido)"

LOGIN=$(curl -sf -w "\n%{http_code}" -X POST "${API}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")

LBODY=$(echo "$LOGIN" | head -n -1)
LCODE=$(echo "$LOGIN" | tail -n 1)

[[ "$LCODE" == "200" ]] || fail "POST /login HTTP $LCODE — $LBODY"
echo "$LBODY" | grep -q 'access_token' || fail "login sin access_token"
ok "login"

if curl -sf -o /dev/null --max-time 3 "${FRONT}/" 2>/dev/null; then
  ok "frontend responde en ${FRONT}"
else
  echo "[verify] AVISO: frontend no accesible en ${FRONT} (¿contenedor frontend?)"
fi

echo ""
echo "[verify] Despliegue correcto. Abre en el navegador:"
echo "  ${FRONT}"
echo "  API: ${API}/docs"
echo ""
