#!/usr/bin/env bash
# =============================================================================
# auth-cli.sh — FL Legal Auth Token Manager
# =============================================================================
#
# Manages editor and lawyer JWT tokens for both local and production.
# Also generates and verifies bcrypt password hashes for .env and Vercel.
#
# Usage:
#   ./auth.sh                  interactive menu
#   ./auth.sh <command>        run a single command
#
# Commands:
#   login:editor                   authenticate as editor → save token
#   login:lawyer                   authenticate as lawyer → save token
#   verify:editor                  decode + verify editor token
#   verify:lawyer                  decode + verify lawyer token
#   token:show                     print both current tokens
#   token:clear                    clear both saved tokens
#   hash:gen                       generate a new bcrypt hash for a password
#   hash:verify                    verify a password against a stored hash
#   health                         API health check
#   env                            show current environment + base URL
#   switch:local                   point CLI at https://localhost:8443
#   switch:prod                    point CLI at https://fl-legal.ca
#
# Token storage:
#   /tmp/fl_editor_token           editor JWT (matches sessionStorage key)
#   /tmp/fl_lawyer_token           lawyer JWT
#
# Dependencies: curl, jq (optional but recommended), node (for hash ops)
# =============================================================================
 
set -euo pipefail
 
# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
 
# ── Config ────────────────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/.auth.env"
TOKEN_EDITOR=/tmp/fl_editor_token
TOKEN_LAWYER=/tmp/fl_lawyer_token
LOCAL_BASE="https://localhost:8228"
PROD_BASE="https://fl-legal.ca"
 
# Load saved base URL or default to local
if [[ -f "$ENV_FILE" ]]; then
  BASE=$(cat "$ENV_FILE")
else
  BASE="$LOCAL_BASE"
fi
 
# ── Helpers ───────────────────────────────────────────────────────────────────
 
is_local() { [[ "$BASE" == *"localhost"* ]]; }
 
curl_flags() {
  if is_local; then
    echo "-sk"          # -k skips TLS verification for self-signed local cert
  else
    echo "-s"
  fi
}
 
pretty() {
  if command -v jq &>/dev/null; then
    jq .
  else
    cat
  fi
}
 
hr() { printf "${BLUE}%*s${NC}\n" 70 | tr ' ' '─'; }
 
header() {
  clear
  hr
  printf "  ${BOLD}FL Legal — Auth Token Manager${NC}\n"
  printf "  env : %s\n" "$(env_label)"
  printf "  base: ${CYAN}%s${NC}\n" "$BASE"
  printf "  editor token : %s\n" "$(token_status "$TOKEN_EDITOR")"
  printf "  lawyer token : %s\n" "$(token_status "$TOKEN_LAWYER")"
  hr
  echo
}
 
env_label() {
  if is_local; then
    echo -e "${YELLOW}LOCAL${NC}"
  else
    echo -e "${GREEN}PRODUCTION${NC}"
  fi
}
 
token_status() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo -e "${RED}not set${NC}"
    return
  fi
  local tok; tok=$(cat "$file")
  local exp; exp=$(decode_token_field "$tok" exp 2>/dev/null || echo "")
  if [[ -z "$exp" ]]; then
    echo -e "${YELLOW}set (unreadable)${NC}"
    return
  fi
  local now; now=$(date +%s)
  if (( exp < now )); then
    echo -e "${RED}expired$(date_since "$exp")${NC}"
  else
    echo -e "${GREEN}valid — expires in $(seconds_to_human $((exp - now)))${NC}"
  fi
}
 
decode_token_field() {
  local token="$1" field="$2"
  # Decode the JWT payload (middle segment), base64url → JSON → field
  local payload; payload=$(echo "$token" | cut -d. -f2)
  # Pad to multiple of 4
  local pad=$(( 4 - ${#payload} % 4 ))
  [[ $pad -ne 4 ]] && payload="${payload}$(printf '=%.0s' $(seq 1 $pad))"
  echo "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null | \
    (command -v jq &>/dev/null && jq -r ".$field" || grep -o "\"$field\":[^,}]*" | cut -d: -f2 | tr -d '"')
}
 
seconds_to_human() {
  local s="$1"
  if (( s > 3600 )); then printf "%dh %dm" $((s/3600)) $(( (s%3600)/60 ))
  elif (( s > 60 )); then printf "%dm %ds" $((s/60)) $((s%60))
  else printf "%ds" "$s"
  fi
}
 
date_since() {
  local exp="$1"
  printf " ($(date -d "@$exp" '+%Y-%m-%d %H:%M' 2>/dev/null || date -r "$exp" '+%Y-%m-%d %H:%M' 2>/dev/null))"
}
 
auth_header() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "-H \"Authorization: Bearer $(cat "$file")\""
  fi
}
 
# ── Commands ──────────────────────────────────────────────────────────────────
 
cmd_health() {
  echo -e "${BOLD}→ GET ${BASE}/api/health${NC}"
  echo
  curl $(curl_flags) "${BASE}/api/health" | pretty
  echo
}
 
cmd_env() {
  echo
  echo -e "  Environment : $(env_label)"
  echo -e "  Base URL    : ${CYAN}${BASE}${NC}"
  echo
  echo -e "  Editor token: $(token_status "$TOKEN_EDITOR")"
  if [[ -f "$TOKEN_EDITOR" ]]; then
    local tok; tok=$(cat "$TOKEN_EDITOR")
    echo -e "  Role        : $(decode_token_field "$tok" role)"
    echo -e "  Subject     : $(decode_token_field "$tok" sub)"
  fi
  echo
  echo -e "  Lawyer token: $(token_status "$TOKEN_LAWYER")"
  if [[ -f "$TOKEN_LAWYER" ]]; then
    local tok; tok=$(cat "$TOKEN_LAWYER")
    echo -e "  uid         : $(decode_token_field "$tok" sub)"
    echo -e "  email       : $(decode_token_field "$tok" email)"
  fi
  echo
}
 
cmd_login_editor() {
  echo -e "${BOLD}Editor Login${NC}"
  echo -e "URL: ${CYAN}${BASE}/api/auth/editor${NC}"
  echo
  read -rsp "  Enter editor password: " pass; echo
 
  local resp
  resp=$(curl $(curl_flags) -X POST "${BASE}/api/auth/editor" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"${pass}\"}" 2>&1)
 
  if echo "$resp" | grep -q '"token"'; then
    local token; token=$(echo "$resp" | (command -v jq &>/dev/null && jq -r '.token' || grep -o '"token":"[^"]*"' | cut -d'"' -f4))
    echo "$token" > "$TOKEN_EDITOR"
    echo
    echo -e "  ${GREEN}✓ Editor token saved${NC}"
    echo -e "  Stored at: ${TOKEN_EDITOR}"
    echo -e "  Status   : $(token_status "$TOKEN_EDITOR")"
    echo
    echo -e "  ${BOLD}Token payload:${NC}"
    decode_token_payload "$token"
  else
    echo
    echo -e "  ${RED}✗ Login failed${NC}"
    echo "  Response: $resp"
  fi
}
 
cmd_login_lawyer() {
  echo -e "${BOLD}Lawyer Login (username + password)${NC}"
  echo -e "URL: ${CYAN}${BASE}/api/auth/lawyer/password${NC}"
  echo
  read -rp  "  Username (e.g. bill.fric): " username
  read -rsp "  Password: " pass; echo
 
  local resp
  resp=$(curl $(curl_flags) -X POST "${BASE}/api/auth/lawyer/password" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"password\":\"${pass}\"}" 2>&1)
 
  if echo "$resp" | grep -q '"token"'; then
    local token; token=$(echo "$resp" | (command -v jq &>/dev/null && jq -r '.token' || grep -o '"token":"[^"]*"' | cut -d'"' -f4))
    echo "$token" > "$TOKEN_LAWYER"
    echo
    echo -e "  ${GREEN}✓ Lawyer token saved${NC}"
    echo -e "  Stored at: ${TOKEN_LAWYER}"
    echo -e "  Status   : $(token_status "$TOKEN_LAWYER")"
    echo
    echo -e "  ${BOLD}Token payload:${NC}"
    decode_token_payload "$token"
  else
    echo
    echo -e "  ${RED}✗ Login failed${NC}"
    echo "  Response: $resp"
  fi
}
 
decode_token_payload() {
  local token="$1"
  local payload; payload=$(echo "$token" | cut -d. -f2)
  local pad=$(( 4 - ${#payload} % 4 ))
  [[ $pad -ne 4 ]] && payload="${payload}$(printf '=%.0s' $(seq 1 $pad))"
  echo "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null | \
    (command -v jq &>/dev/null && jq . || cat)
}
 
cmd_verify_editor() {
  echo -e "${BOLD}Editor Token Verification${NC}"
  echo
  if [[ ! -f "$TOKEN_EDITOR" ]]; then
    echo -e "  ${RED}No editor token saved. Run login:editor first.${NC}"
    return
  fi
  local tok; tok=$(cat "$TOKEN_EDITOR")
  echo -e "  Status: $(token_status "$TOKEN_EDITOR")"
  echo
  echo -e "  ${BOLD}Decoded payload:${NC}"
  decode_token_payload "$tok"
  echo
  echo -e "  ${BOLD}Live API test — GET /api/content/home with editor token:${NC}"
  curl $(curl_flags) "${BASE}/api/content/home" \
    -H "Authorization: Bearer $tok" | \
    (command -v jq &>/dev/null && jq 'keys' || head -c 200)
  echo
}
 
cmd_verify_lawyer() {
  echo -e "${BOLD}Lawyer Token Verification${NC}"
  echo
  if [[ ! -f "$TOKEN_LAWYER" ]]; then
    echo -e "  ${RED}No lawyer token saved. Run login:lawyer first.${NC}"
    return
  fi
  local tok; tok=$(cat "$TOKEN_LAWYER")
  echo -e "  Status: $(token_status "$TOKEN_LAWYER")"
  echo
  echo -e "  ${BOLD}Decoded payload:${NC}"
  decode_token_payload "$tok"
  echo
  echo -e "  ${BOLD}Live API test — GET /api/calendar with lawyer token:${NC}"
  curl $(curl_flags) "${BASE}/api/calendar" \
    -H "Authorization: Bearer $tok" | \
    (command -v jq &>/dev/null && jq 'length' || head -c 200)
  echo
}
 
cmd_token_show() {
  echo -e "${BOLD}Saved Tokens${NC}"
  echo
  echo -e "  ${CYAN}Editor${NC}"
  if [[ -f "$TOKEN_EDITOR" ]]; then
    echo "  $(cat "$TOKEN_EDITOR")"
    echo
    decode_token_payload "$(cat "$TOKEN_EDITOR")"
  else
    echo -e "  ${RED}not set${NC}"
  fi
  echo
  echo -e "  ${CYAN}Lawyer${NC}"
  if [[ -f "$TOKEN_LAWYER" ]]; then
    echo "  $(cat "$TOKEN_LAWYER")"
    echo
    decode_token_payload "$(cat "$TOKEN_LAWYER")"
  else
    echo -e "  ${RED}not set${NC}"
  fi
}
 
cmd_token_clear() {
  rm -f "$TOKEN_EDITOR" "$TOKEN_LAWYER"
  echo -e "  ${GREEN}✓ Both tokens cleared${NC}"
}
 
cmd_hash_gen() {
  echo -e "${BOLD}Generate bcrypt hash${NC}"
  echo -e "  Used to set ${CYAN}EDITOR_HASH${NC} or ${CYAN}ADMIN_HASH${NC} in .env / Vercel"
  echo
  read -rsp "  Enter password to hash: " pass; echo
  read -rsp "  Confirm password: " pass2; echo
 
  if [[ "$pass" != "$pass2" ]]; then
    echo -e "  ${RED}✗ Passwords do not match${NC}"
    return
  fi
 
  echo
  echo -e "  Generating bcrypt hash (rounds=12)..."
  local hash
  hash=$(node -e "
    const bcrypt = require('bcrypt');
    bcrypt.hash('${pass//\'/\\\'}', 12).then(h => {
      console.log(h);
    }).catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
  " 2>&1)
 
  if [[ $? -eq 0 ]]; then
    echo
    echo -e "  ${GREEN}✓ Hash generated:${NC}"
    echo
    echo "  $hash"
    echo
    echo -e "  ${BOLD}Add to server/.env:${NC}"
    echo "  EDITOR_HASH=$hash"
    echo
    echo -e "  ${BOLD}Add to Vercel env vars:${NC}"
    echo "  Key:   EDITOR_HASH"
    echo "  Value: $hash"
  else
    echo -e "  ${RED}✗ Hash generation failed: $hash${NC}"
    echo -e "  Is bcrypt installed? Run: cd server && npm install"
  fi
}
 
cmd_hash_verify() {
  echo -e "${BOLD}Verify password against stored hash${NC}"
  echo -e "  Useful for confirming your .env hash matches your intended password"
  echo
  read -rsp "  Enter password: " pass; echo
  read -rp  "  Paste the hash (e.g. \$2a\$12\$...): " hash
  echo
 
  local result
  result=$(node -e "
    const bcrypt = require('bcrypt');
    bcrypt.compare('${pass//\'/\\\'}', '${hash//\'/\\\'}').then(ok => {
      console.log(ok ? 'MATCH' : 'NO_MATCH');
    }).catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
  " 2>&1)
 
  echo
  if [[ "$result" == "MATCH" ]]; then
    echo -e "  ${GREEN}✓ Password matches the hash${NC}"
  elif [[ "$result" == "NO_MATCH" ]]; then
    echo -e "  ${RED}✗ Password does NOT match the hash${NC}"
  else
    echo -e "  ${RED}✗ Error: $result${NC}"
  fi
}
 
cmd_switch_local() {
  echo "$LOCAL_BASE" > "$ENV_FILE"
  BASE="$LOCAL_BASE"
  rm -f "$TOKEN_EDITOR" "$TOKEN_LAWYER"   # clear tokens — different env
  echo -e "  ${GREEN}✓ Switched to LOCAL (${LOCAL_BASE})${NC}"
  echo -e "  Tokens cleared — re-login required"
}
 
cmd_switch_prod() {
  echo
  echo -e "  ${YELLOW}⚠  Switching to PRODUCTION (${PROD_BASE})${NC}"
  echo -e "  Tokens from local are not valid in production."
  read -rp "  Confirm? [y/N] " confirm
  if [[ "${confirm,,}" == "y" ]]; then
    echo "$PROD_BASE" > "$ENV_FILE"
    BASE="$PROD_BASE"
    rm -f "$TOKEN_EDITOR" "$TOKEN_LAWYER"
    echo -e "  ${GREEN}✓ Switched to PRODUCTION${NC}"
    echo -e "  Tokens cleared — re-login required"
  else
    echo "  Cancelled."
  fi
}
 
# ── Interactive menu ──────────────────────────────────────────────────────────
 
menu() {
  while true; do
    header
 
    echo -e "  ${BOLD}Authentication${NC}"
    echo "   1) Login as editor"
    echo "   2) Login as lawyer"
    echo "   3) Verify editor token"
    echo "   4) Verify lawyer token"
    echo "   5) Show raw tokens"
    echo "   6) Clear all tokens"
    echo
    echo -e "  ${BOLD}Password Hashes${NC}"
    echo "   7) Generate bcrypt hash  (for .env / Vercel)"
    echo "   8) Verify password vs hash"
    echo
    echo -e "  ${BOLD}Environment${NC}"
    echo "   9) Switch to LOCAL  (https://localhost:8443)"
    echo "   0) Switch to PRODUCTION (https://fl-legal.ca)"
    echo "   h) Health check"
    echo "   e) Show environment info"
    echo
    echo "   q) Quit"
    echo
    read -rp "  Choice: " choice
 
    case "$choice" in
      1)  cmd_login_editor ;;
      2)  cmd_login_lawyer ;;
      3)  cmd_verify_editor ;;
      4)  cmd_verify_lawyer ;;
      5)  cmd_token_show ;;
      6)  cmd_token_clear ;;
      7)  cmd_hash_gen ;;
      8)  cmd_hash_verify ;;
      9)  cmd_switch_local ;;
      0)  cmd_switch_prod ;;
      h)  cmd_health ;;
      e)  cmd_env ;;
      q|Q) echo; exit 0 ;;
      *)  echo -e "  ${RED}Unknown option${NC}" ;;
    esac
 
    echo
    read -rp "  Press Enter to continue..." _
  done
}
 
# ── Entry point ───────────────────────────────────────────────────────────────
 
case "${1:-}" in
  login:editor)    cmd_login_editor ;;
  login:lawyer)    cmd_login_lawyer ;;
  verify:editor)   cmd_verify_editor ;;
  verify:lawyer)   cmd_verify_lawyer ;;
  token:show)      cmd_token_show ;;
  token:clear)     cmd_token_clear ;;
  hash:gen)        cmd_hash_gen ;;
  hash:verify)     cmd_hash_verify ;;
  health)          cmd_health ;;
  env)             cmd_env ;;
  switch:local)    cmd_switch_local ;;
  switch:prod)     cmd_switch_prod ;;
  "")              menu ;;
  *)
    echo "Unknown command: $1"
    echo "Run without arguments for the interactive menu."
    exit 1
    ;;
esac