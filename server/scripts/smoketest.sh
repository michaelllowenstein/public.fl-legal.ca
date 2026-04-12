#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# smoketest.sh  —  Interactive test client for fl-legal-api
#
# Usage:
#   chmod +x smoketest.sh
#   ./smoketest.sh                        # interactive menu
#   ./smoketest.sh health                 # run a single command directly
#   ./smoketest.sh content home           # pass args inline
#   BASE=https://localhost:3000 ./smoketest.sh   # override base URL
# ─────────────────────────────────────────────────────────────────────────────

BASE="${BASE:-https://localhost:6666}"
TOKEN_FILE="/tmp/fl_editor_token"
LAWYER_TOKEN_FILE="/tmp/fl_lawyer_token"

# ── Colours ───────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m'
B='\033[0;34m' C='\033[0;36m' W='\033[0m' BOLD='\033[1m'

# ── Helpers ───────────────────────────────────────────────────────────────────

# curl wrapper — skips TLS verification for self-signed certs (-k)
# pretty-prints JSON if jq is available
fl_curl() {
  local method="$1"; shift
  local path="$1";   shift
  local extra_args=("$@")

  local url="${BASE}${path}"
  local token=""

  # Attach stored token if present
  if [[ -f "$LAWYER_TOKEN_FILE" ]]; then
    token=$(cat "$LAWYER_TOKEN_FILE")
  elif [[ -f "$TOKEN_FILE" ]]; then
    token=$(cat "$TOKEN_FILE")
  fi

  local auth_header=()
  [[ -n "$token" ]] && auth_header=(-H "Authorization: Bearer $token")

  echo -e "\n${B}${method} ${url}${W}"

  local response
  response=$(curl -sk -X "$method" \
    -H "Content-Type: application/json" \
    "${auth_header[@]}" \
    "${extra_args[@]}" \
    -w "\n__STATUS__%{http_code}" \
    "$url")

  local status
  status=$(echo "$response" | tail -1 | sed 's/__STATUS__//')
  local body
  body=$(echo "$response" | sed '$d')

  # Colour the status code
  if   [[ $status -lt 300 ]]; then echo -e "${G}● $status${W}"
  elif [[ $status -lt 400 ]]; then echo -e "${Y}● $status${W}"
  else                              echo -e "${R}● $status${W}"
  fi

  # Pretty-print if jq available, otherwise raw
  if command -v jq &>/dev/null && [[ -n "$body" ]]; then
    echo "$body" | jq .
  else
    echo "$body"
  fi
  echo ""
}

print_header() {
  clear
  echo -e "${BOLD}${C}"
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║      FL Legal API  —  Test Client    ║"
  echo "  ╚══════════════════════════════════════╝${W}"
  echo -e "  Base URL : ${Y}${BASE}${W}"

  local editor_status="${R}not logged in${W}"
  local lawyer_status="${R}not logged in${W}"
  [[ -f "$TOKEN_FILE" ]]        && editor_status="${G}token stored${W}"
  [[ -f "$LAWYER_TOKEN_FILE" ]] && lawyer_status="${G}token stored${W}"

  echo -e "  Editor   : $editor_status"
  echo -e "  Lawyer   : $lawyer_status"
  echo ""
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_health() {
  fl_curl GET /health
}

cmd_content_all() {
  fl_curl GET /api/content
}

cmd_content_section() {
  local section="${1:-home}"
  [[ -z "$1" ]] && read -rp "  Section name (home/aboutUs/areasOfLaw/pricing/faq): " section
  fl_curl GET "/api/content/${section}"
}

cmd_content_patch() {
  local key value
  read -rp "  Field key  (e.g. home/header): " key
  read -rp "  New value : " value
  fl_curl PATCH /api/content -d "{\"key\":\"${key}\",\"value\":\"${value}\"}"
}

cmd_editor_login() {
  local pass
  read -rsp "  Editor password: " pass; echo ""
  local response
  response=$(curl -sk -X POST \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"${pass}\"}" \
    -w "\n__STATUS__%{http_code}" \
    "${BASE}/api/auth/editor")

  local status body token
  status=$(echo "$response" | tail -1 | sed 's/__STATUS__//')
  body=$(echo "$response" | sed '$d')

  if [[ $status -eq 200 ]]; then
    token=$(echo "$body" | (command -v jq &>/dev/null && jq -r '.token' || grep -o '"token":"[^"]*"' | cut -d'"' -f4))
    echo "$token" > "$TOKEN_FILE"
    echo -e "${G}  ✓ Editor token saved${W}"
  else
    echo -e "${R}  ✗ Login failed ($status)${W}"
    echo "$body"
  fi
}

cmd_editor_logout() {
  rm -f "$TOKEN_FILE"
  echo -e "${Y}  Editor token cleared${W}"
}

cmd_lawyer_login() {
  local user pass
  read -rp  "  Username: " user
  read -rsp "  Password: " pass; echo ""
  local response
  response=$(curl -sk -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" \
    -w "\n__STATUS__%{http_code}" \
    "${BASE}/api/auth/lawyer/password")

  local status body token
  status=$(echo "$response" | tail -1 | sed 's/__STATUS__//')
  body=$(echo "$response" | sed '$d')

  if [[ $status -eq 200 ]]; then
    token=$(echo "$body" | (command -v jq &>/dev/null && jq -r '.token' || grep -o '"token":"[^"]*"' | cut -d'"' -f4))
    echo "$token" > "$LAWYER_TOKEN_FILE"
    echo -e "${G}  ✓ Lawyer token saved${W}"
  else
    echo -e "${R}  ✗ Login failed ($status)${W}"
    echo "$body"
  fi
}

cmd_lawyer_logout() {
  rm -f "$LAWYER_TOKEN_FILE"
  echo -e "${Y}  Lawyer token cleared${W}"
}

cmd_calendar_list() {
  fl_curl GET /api/calendar
}

cmd_calendar_add() {
  local title date time desc
  read -rp "  Title      : " title
  read -rp "  Date       : (YYYY-MM-DD) " date
  read -rp "  Time       : (HH:MM, optional) " time
  read -rp "  Description: (optional) " desc

  local body="{\"title\":\"${title}\",\"date\":\"${date}\""
  [[ -n "$time" ]] && body+=",\"time\":\"${time}\""
  [[ -n "$desc" ]] && body+=",\"description\":\"${desc}\""
  body+="}"

  fl_curl POST /api/calendar -d "$body"
}

cmd_calendar_delete() {
  local id
  read -rp "  Event ID: " id
  fl_curl DELETE "/api/calendar/${id}"
}

cmd_blog_list() {
  fl_curl GET /api/blog
}

cmd_blog_get() {
  local id
  read -rp "  Post ID: " id
  fl_curl GET "/api/blog/${id}"
}

cmd_inquiry_general() {
  local name email phone message
  read -rp "  Name   : " name
  read -rp "  Email  : " email
  read -rp "  Phone  : (optional) " phone
  read -rp "  Message: " message

  local body="{\"name\":\"${name}\",\"email\":\"${email}\",\"message\":\"${message}\""
  [[ -n "$phone" ]] && body+=",\"phone\":\"${phone}\""
  body+="}"

  fl_curl POST /api/inquiries -d "$body"
}

cmd_inquiry_priority() {
  local name email phone message area
  read -rp "  Name         : " name
  read -rp "  Email        : " email
  read -rp "  Phone        : (optional) " phone
  read -rp "  Practice area: (optional) " area
  read -rp "  Message      : " message

  local body="{\"name\":\"${name}\",\"email\":\"${email}\",\"message\":\"${message}\""
  [[ -n "$phone" ]] && body+=",\"phone\":\"${phone}\""
  [[ -n "$area"  ]] && body+=",\"practiceArea\":\"${area}\""
  body+="}"

  fl_curl POST /api/inquiries/priority -d "$body"
}

cmd_show_token() {
  echo ""
  if [[ -f "$TOKEN_FILE" ]]; then
    echo -e "${C}Editor token:${W}"
    cat "$TOKEN_FILE"; echo ""
  fi
  if [[ -f "$LAWYER_TOKEN_FILE" ]]; then
    echo -e "${C}Lawyer token:${W}"
    cat "$LAWYER_TOKEN_FILE"; echo ""
  fi
  if [[ ! -f "$TOKEN_FILE" && ! -f "$LAWYER_TOKEN_FILE" ]]; then
    echo -e "${Y}  No tokens stored${W}"
  fi
}

# ── Single-command non-interactive mode ───────────────────────────────────────

if [[ -n "$1" ]]; then
  case "$1" in
    health)             cmd_health ;;
    content)            cmd_content_section "$2" ;;
    content:all)        cmd_content_all ;;
    content:patch)      cmd_content_patch ;;
    login:editor)       cmd_editor_login ;;
    login:lawyer)       cmd_lawyer_login ;;
    logout)             cmd_editor_logout; cmd_lawyer_logout ;;
    calendar)           cmd_calendar_list ;;
    calendar:add)       cmd_calendar_add ;;
    calendar:delete)    cmd_calendar_delete ;;
    blog)               cmd_blog_list ;;
    blog:get)           cmd_blog_get ;;
    inquiry)            cmd_inquiry_general ;;
    inquiry:priority)   cmd_inquiry_priority ;;
    token)              cmd_show_token ;;
    *)
      echo -e "${R}Unknown command: $1${W}"
      echo "Commands: health | content [section] | content:all | content:patch"
      echo "          login:editor | login:lawyer | logout | token"
      echo "          calendar | calendar:add | calendar:delete"
      echo "          blog | blog:get | inquiry | inquiry:priority"
      exit 1
      ;;
  esac
  exit 0
fi

# ── Interactive menu ──────────────────────────────────────────────────────────

while true; do
  print_header
  echo -e "  ${BOLD}General${W}"
  echo "   1) Health check"
  echo ""
  echo -e "  ${BOLD}Auth${W}"
  echo "   2) Editor login      3) Editor logout"
  echo "   4) Lawyer login      5) Lawyer logout"
  echo "   6) Show stored tokens"
  echo ""
  echo -e "  ${BOLD}Site Content${W}"
  echo "   7) Fetch all content"
  echo "   8) Fetch section     9) Patch a field"
  echo ""
  echo -e "  ${BOLD}Blog${W}"
  echo "  10) List posts       11) Get post by ID"
  echo ""
  echo -e "  ${BOLD}Inquiries (email)${W}"
  echo "  12) Send general     13) Send priority"
  echo ""
  echo -e "  ${BOLD}Calendar${W}  ${Y}(lawyer token required)${W}"
  echo "  14) List events      15) Add event      16) Delete event"
  echo ""
  echo "   q) Quit"
  echo ""
  read -rp "  → " choice

  case "$choice" in
    1)  cmd_health ;;
    2)  cmd_editor_login ;;
    3)  cmd_editor_logout ;;
    4)  cmd_lawyer_login ;;
    5)  cmd_lawyer_logout ;;
    6)  cmd_show_token ;;
    7)  cmd_content_all ;;
    8)  cmd_content_section ;;
    9)  cmd_content_patch ;;
    10) cmd_blog_list ;;
    11) cmd_blog_get ;;
    12) cmd_inquiry_general ;;
    13) cmd_inquiry_priority ;;
    14) cmd_calendar_list ;;
    15) cmd_calendar_add ;;
    16) cmd_calendar_delete ;;
    q|Q) echo ""; exit 0 ;;
    *) echo -e "${R}  Invalid choice${W}" ;;
  esac

  read -rp "  Press Enter to continue..." _
done