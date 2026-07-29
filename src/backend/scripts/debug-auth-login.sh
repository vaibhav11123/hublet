#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"

# shellcheck disable=SC1090
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

BACKEND_BASE_URL="${1:-${BASE_URL:-http://localhost:${PORT:-3000}}}"
BACKEND_BASE_URL="${BACKEND_BASE_URL%/}"

ADMIN_EMAIL_VALUE="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-}"
SUPER_PASSWORD_VALUE="${SUPER_PASSWORD:-}"

RUN_ID="$(date +%s)"
BUYER_EMAIL="debug.buyer.${RUN_ID}@test.local"
SELLER_EMAIL="debug.seller.${RUN_ID}@test.local"
KNOWN_PASSWORD="DebugPass@123"

FAIL_COUNT=0
LAST_CODE=""
LAST_BODY=""
ADMIN_TOKEN=""
BUYER_ID=""
SELLER_ID=""

log() {
  printf "%s\n" "$1"
}

pass() {
  printf "[PASS] %s\n" "$1"
}

fail() {
  printf "[FAIL] %s\n" "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

extract_json_field() {
  local json="$1"
  local path="$2"
  node -e '
const raw = process.argv[1];
const path = process.argv[2].split(".");
try {
  let value = JSON.parse(raw);
  for (const part of path) value = value?.[part];
  if (value === undefined || value === null) process.exit(2);
  process.stdout.write(String(value));
} catch {
  process.exit(1);
}
' "${json}" "${path}" 2>/dev/null
}

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"
  local tmp_file

  tmp_file="$(mktemp)"
  local curl_args=(
    -sS
    -o "${tmp_file}"
    -w "%{http_code}"
    -X "${method}"
    "${url}"
  )

  if [[ -n "${token}" ]]; then
    curl_args+=(-H "Authorization: Bearer ${token}")
  fi

  if [[ -n "${data}" ]]; then
    curl_args+=(-H "Content-Type: application/json" -d "${data}")
  fi

  if ! LAST_CODE="$(curl "${curl_args[@]}" 2>/dev/null)"; then
    LAST_CODE="000"
  fi
  LAST_BODY="$(cat "${tmp_file}" 2>/dev/null || true)"
  rm -f "${tmp_file}"
}

expect_code() {
  local expected="$1"
  local message="$2"
  if [[ "${LAST_CODE}" == "${expected}" ]]; then
    pass "${message} (HTTP ${LAST_CODE})"
  else
    fail "${message} (expected HTTP ${expected}, got ${LAST_CODE})"
    log "  Response: ${LAST_BODY}"
  fi
}

login_admin() {
  if [[ -z "${ADMIN_EMAIL_VALUE}" || -z "${ADMIN_PASSWORD_VALUE}" ]]; then
    fail "ADMIN_EMAIL / ADMIN_PASSWORD is not set in ${ENV_FILE}"
    return
  fi

  request "POST" "${BACKEND_BASE_URL}/api/auth/admin/login" \
    "{\"email\":\"${ADMIN_EMAIL_VALUE}\",\"password\":\"${ADMIN_PASSWORD_VALUE}\"}"
  expect_code "200" "Admin login route is reachable"

  if [[ "${LAST_CODE}" == "200" ]]; then
    ADMIN_TOKEN="$(extract_json_field "${LAST_BODY}" "token" || true)"
    if [[ -n "${ADMIN_TOKEN}" ]]; then
      pass "Admin JWT token extracted"
    else
      fail "Admin login succeeded but token could not be parsed"
    fi
  fi
}

debug_buyer() {
  request "POST" "${BACKEND_BASE_URL}/api/auth/buyer/signup" \
    "{\"name\":\"Debug Buyer\",\"email\":\"${BUYER_EMAIL}\",\"password\":\"${KNOWN_PASSWORD}\",\"localities\":[\"Mumbai\"],\"amenities\":[\"parking\"]}"
  expect_code "201" "Buyer signup with known password"

  if [[ "${LAST_CODE}" == "201" ]]; then
    BUYER_ID="$(extract_json_field "${LAST_BODY}" "id" || true)"
  fi

  request "POST" "${BACKEND_BASE_URL}/api/auth/buyer/login" \
    "{\"email\":\"${BUYER_EMAIL}\",\"password\":\"${KNOWN_PASSWORD}\"}"
  expect_code "200" "Buyer login with correct email/password"

  if [[ -z "${SUPER_PASSWORD_VALUE}" ]]; then
    fail "SUPER_PASSWORD is not set in ${ENV_FILE}"
  else
    request "POST" "${BACKEND_BASE_URL}/api/auth/buyer/login" \
      "{\"email\":\"${BUYER_EMAIL}\",\"password\":\"${w}\"}"
    expect_code "200" "Buyer login with super password"
  fi

  request "POST" "${BACKEND_BASE_URL}/api/auth/buyer/login" \
    "{\"email\":\"${BUYER_EMAIL}\",\"password\":\"Wrong@123\"}"
  expect_code "401" "Buyer login rejects wrong password"
}

debug_seller() {
  request "POST" "${BACKEND_BASE_URL}/api/auth/seller/signup" \
    "{\"name\":\"Debug Seller\",\"email\":\"${SELLER_EMAIL}\",\"password\":\"${KNOWN_PASSWORD}\",\"sellerType\":\"owner\",\"rating\":4.2}"
  expect_code "201" "Seller signup with known password"

  if [[ "${LAST_CODE}" == "201" ]]; then
    SELLER_ID="$(extract_json_field "${LAST_BODY}" "id" || true)"
  fi

  request "POST" "${BACKEND_BASE_URL}/api/auth/seller/login" \
    "{\"email\":\"${SELLER_EMAIL}\",\"password\":\"${KNOWN_PASSWORD}\"}"
  expect_code "200" "Seller login with correct email/password"

  if [[ -z "${SUPER_PASSWORD_VALUE}" ]]; then
    fail "SUPER_PASSWORD is not set in ${ENV_FILE}"
  else
    request "POST" "${BACKEND_BASE_URL}/api/auth/seller/login" \
      "{\"email\":\"${SELLER_EMAIL}\",\"password\":\"${SUPER_PASSWORD_VALUE}\"}"
    expect_code "200" "Seller login with super password"
  fi

  request "POST" "${BACKEND_BASE_URL}/api/auth/seller/login" \
    "{\"email\":\"${SELLER_EMAIL}\",\"password\":\"Wrong@123\"}"
  expect_code "401" "Seller login rejects wrong password"
}

cleanup() {
  if [[ -z "${ADMIN_TOKEN}" ]]; then
    log "Cleanup skipped: admin token unavailable."
    return
  fi

  if [[ -n "${BUYER_ID}" ]]; then
    request "DELETE" "${BACKEND_BASE_URL}/api/buyers/${BUYER_ID}" "" "${ADMIN_TOKEN}"
    if [[ "${LAST_CODE}" == "204" ]]; then
      pass "Cleanup buyer (${BUYER_EMAIL})"
    else
      fail "Cleanup buyer failed (HTTP ${LAST_CODE})"
      log "  Response: ${LAST_BODY}"
    fi
  fi

  if [[ -n "${SELLER_ID}" ]]; then
    request "DELETE" "${BACKEND_BASE_URL}/api/sellers/${SELLER_ID}" "" "${ADMIN_TOKEN}"
    if [[ "${LAST_CODE}" == "204" ]]; then
      pass "Cleanup seller (${SELLER_EMAIL})"
    else
      fail "Cleanup seller failed (HTTP ${LAST_CODE})"
      log "  Response: ${LAST_BODY}"
    fi
  fi
}

log "Auth debug start"
log "Backend URL: ${BACKEND_BASE_URL}"
log "Env file: ${ENV_FILE}"

request "GET" "${BACKEND_BASE_URL}/health"
expect_code "200" "Health check"

login_admin
debug_buyer
debug_seller
cleanup

log ""
if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  pass "All auth debug checks passed."
  exit 0
fi

fail "Auth debug completed with ${FAIL_COUNT} failure(s)."
exit 1
