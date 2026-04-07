#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# fl-api-demos.sh  —  Scripted demo sequences for fl-legal-api
#
# Extends fl-api-cli.sh with canned payloads for:
#   • Content edit + undo (demonstrates PATCH /api/content round-trip)
#   • Email inquiry templates (general + priority)
#   • Calendar CRUD round-trip
#
# Usage:
#   chmod +x fl-api-demos.sh
#   ./fl-api-demos.sh                        # interactive demo menu
#   ./fl-api-demos.sh demo:content           # run content edit demo directly
#   ./fl-api-demos.sh demo:undo              # undo the last demo edit
#   ./fl-api-demos.sh demo:email             # send test general inquiry
#   ./fl-api-demos.sh demo:email:priority    # send test priority inquiry
#   ./fl-api-demos.sh demo:calendar          # add + list + delete round-trip
#
# Requires: fl-api-cli.sh in the same directory (sources its helpers)
# ─────────────────────────────────────────────────────────────────────────────

BASE="${BASE:-https://localhost:6666}"
TOKEN_FILE="/tmp/fl_editor_token"

R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m'
B='\033[0;34m' C='\033[0;36m' W='\033[0m' BOLD='\033[1m'

# ── Snapshot file — stores original values before demo edits ─────────────────
SNAPSHOT_FILE="/tmp/fl_demo_snapshot"

# ── Curl helper (mirrors fl-api-cli.sh) ──────────────────────────────────────
fl_curl() {
  local method="$1"; shift
  local path="$1";   shift
  local extra_args=("$@")
  local url="${BASE}${path}"
  local token=""
  [[ -f "$TOKEN_FILE" ]] && token=$(cat "$TOKEN_FILE")
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

  local status body
  status=$(echo "$response" | tail -1 | sed 's/__STATUS__//')
  body=$(echo "$response" | sed '$d')

  if   [[ $status -lt 300 ]]; then echo -e "${G}● $status${W}"
  elif [[ $status -lt 400 ]]; then echo -e "${Y}● $status${W}"
  else                              echo -e "${R}● $status${W}"
  fi

  command -v jq &>/dev/null && [[ -n "$body" ]] && echo "$body" | jq . || echo "$body"
  echo ""
  # Return body for capture
  echo "$body" > /tmp/fl_last_response
}

step() { echo -e "\n${C}${BOLD}── $1 ──${W}"; }
pause() { read -rp "  ${Y}Press Enter to continue...${W}" _; }

# ─────────────────────────────────────────────────────────────────────────────
# DEMO 1 — Content edit + undo
# Edits three fields across two sections, saves originals, then restores them.
# ─────────────────────────────────────────────────────────────────────────────

# Payloads: [field_key]="new value"   (originals fetched live before patching)
declare -A DEMO_EDITS=(
  ["home/header"]="Trusted Legal Counsel — Calgary Since 1982"
  ["home/subheader"]="FL &amp; Co. LLP: Decades of Excellence"
  ["areasOfLaw/header"]="Our Practice Areas"
)

demo_content_edit() {
  step "Content Edit Demo"
  echo "  Patches 3 fields, saves originals, then prompts to undo."
  echo ""

  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo -e "${R}  ✗  Editor token not found. Run: ./fl-api-cli.sh login:editor first.${W}"
    return 1
  fi

  # ── Fetch and snapshot originals ──────────────────────────────────────────
  step "1 / 3  Snapshotting originals"
  > "$SNAPSHOT_FILE"

  for key in "${!DEMO_EDITS[@]}"; do
    local section
    section=$(echo "$key" | cut -d/ -f1)
    local field
    field=$(echo "$key" | cut -d/ -f2-)

    local original
    original=$(curl -sk "${BASE}/api/content/${section}" | \
      (command -v jq &>/dev/null && jq -r ".${field} // empty" 2>/dev/null || echo ""))

    echo "${key}|||${original}" >> "$SNAPSHOT_FILE"
    echo -e "  saved  ${Y}${key}${W} = \"${original:0:60}...\""
  done

  pause

  # ── Apply demo edits ──────────────────────────────────────────────────────
  step "2 / 3  Applying demo edits"

  for key in "${!DEMO_EDITS[@]}"; do
    local value="${DEMO_EDITS[$key]}"
    echo -e "  patching  ${Y}${key}${W}"
    fl_curl PATCH /api/content -d "{\"key\":\"${key}\",\"value\":\"${value}\"}"
    sleep 0.3
  done

  echo -e "${G}  ✓  Demo edits applied. Check the site in your browser.${W}"
  pause

  # ── Verify by reading back ────────────────────────────────────────────────
  step "2b / 3  Verifying edits were persisted"
  fl_curl GET /api/content/home
  pause

  # ── Undo ─────────────────────────────────────────────────────────────────
  step "3 / 3  Undoing — restoring originals"
  demo_undo
}

demo_undo() {
  if [[ ! -f "$SNAPSHOT_FILE" ]]; then
    echo -e "${R}  ✗  No snapshot found. Run demo:content first.${W}"
    return 1
  fi

  while IFS='|||' read -r key original; do
    [[ -z "$key" ]] && continue
    echo -e "  restoring  ${Y}${key}${W}"
    # Escape for JSON
    local escaped
    escaped=$(echo "$original" | sed 's/\\/\\\\/g; s/"/\\"/g')
    fl_curl PATCH /api/content -d "{\"key\":\"${key}\",\"value\":\"${escaped}\"}"
    sleep 0.3
  done < "$SNAPSHOT_FILE"

  rm -f "$SNAPSHOT_FILE"
  echo -e "${G}  ✓  All fields restored to original values.${W}"
}

# ─────────────────────────────────────────────────────────────────────────────
# DEMO 2 — Email inquiry templates
# Sends canned payloads to both inquiry endpoints with realistic test data.
# ─────────────────────────────────────────────────────────────────────────────

demo_email_general() {
  step "General Inquiry Email Demo"
  cat <<'PAYLOAD'
  Payload:
  {
    "name":    "James Thornton",
    "email":   "j.thornton@testmail.dev",
    "phone":   "(403) 555-0142",
    "message": "Hello, I am looking for legal representation regarding a
                residential real estate purchase. I am a first-time buyer
                and would like to understand your fees and availability.
                Please contact me at your earliest convenience."
  }
PAYLOAD
  echo ""
  pause

  fl_curl POST /api/inquiries -d '{
    "name":    "James Thornton",
    "email":   "j.thornton@testmail.dev",
    "phone":   "(403) 555-0142",
    "message": "Hello, I am looking for legal representation regarding a residential real estate purchase. I am a first-time buyer and would like to understand your fees and availability. Please contact me at your earliest convenience."
  }'
}

demo_email_priority() {
  step "Priority Inquiry Email Demo"
  cat <<'PAYLOAD'
  Payload:
  {
    "name":         "Sandra Okafor",
    "email":        "s.okafor@testmail.dev",
    "phone":        "(403) 555-0198",
    "practiceArea": "Civil Litigation",
    "message":      "I am involved in a commercial dispute with a contractor
                    who has abandoned a project mid-way and retained our
                    deposit. We need urgent legal advice. This is time sensitive
                    as a limitation period may be approaching."
  }
PAYLOAD
  echo ""
  pause

  fl_curl POST /api/inquiries/priority -d '{
    "name":         "Sandra Okafor",
    "email":        "s.okafor@testmail.dev",
    "phone":        "(403) 555-0198",
    "practiceArea": "Civil Litigation",
    "message":      "I am involved in a commercial dispute with a contractor who has abandoned a project mid-way and retained our deposit. We need urgent legal advice. This is time sensitive as a limitation period may be approaching."
  }'
}

# ─────────────────────────────────────────────────────────────────────────────
# DEMO 3 — Calendar CRUD round-trip
# Adds an event, lists it, then deletes it.
# ─────────────────────────────────────────────────────────────────────────────

demo_calendar() {
  step "Calendar Round-trip Demo"
  echo "  Creates an event, lists it, then cleans up."
  echo ""

  if [[ ! -f /tmp/fl_lawyer_token ]]; then
    echo -e "${R}  ✗  Lawyer token not found. Run: ./fl-api-cli.sh login:lawyer first.${W}"
    return 1
  fi

  # Add event
  step "1 / 3  Adding test event"
  fl_curl POST /api/calendar -d '{
    "title":       "Demo: Client Consultation — Real Estate",
    "date":        "2026-04-15",
    "time":        "10:00",
    "description": "Initial consultation re: residential purchase 11012 Macleod Trail. Client: James Thornton."
  }'

  # Extract the created event ID
  local event_id
  event_id=$(cat /tmp/fl_last_response | \
    (command -v jq &>/dev/null && jq -r '.id // .key // empty' 2>/dev/null || \
     grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4))

  echo -e "  Created event ID: ${Y}${event_id}${W}"
  pause

  # List events
  step "2 / 3  Listing all events (confirm it appears)"
  fl_curl GET /api/calendar
  pause

  # Delete event
  step "3 / 3  Deleting test event"
  if [[ -n "$event_id" ]]; then
    fl_curl DELETE "/api/calendar/${event_id}"
    echo -e "${G}  ✓  Event deleted. Calendar clean.${W}"
  else
    echo -e "${Y}  ⚠  Could not extract event ID — delete manually via:${W}"
    echo -e "     ${B}./fl-api-cli.sh calendar:delete${W}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# CLI dispatch
# ─────────────────────────────────────────────────────────────────────────────

print_demo_header() {
  clear
  echo -e "${BOLD}${C}"
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║      FL Legal API  —  Demo Runner    ║"
  echo "  ╚══════════════════════════════════════╝${W}"
  echo -e "  Base URL : ${Y}${BASE}${W}"
  local etok="${R}none${W}"; [[ -f "$TOKEN_FILE" ]] && etok="${G}stored${W}"
  local ltok="${R}none${W}"; [[ -f /tmp/fl_lawyer_token ]] && ltok="${G}stored${W}"
  echo -e "  Editor   : $etok    Lawyer: $ltok"
  echo ""
}

if [[ -n "$1" ]]; then
  case "$1" in
    demo:content)        demo_content_edit ;;
    demo:undo)           demo_undo ;;
    demo:email)          demo_email_general ;;
    demo:email:priority) demo_email_priority ;;
    demo:calendar)       demo_calendar ;;
    *)
      echo -e "${R}Unknown command: $1${W}"
      echo "Commands: demo:content | demo:undo | demo:email | demo:email:priority | demo:calendar"
      exit 1
      ;;
  esac
  exit 0
fi

# Interactive menu
while true; do
  print_demo_header
  echo -e "  ${BOLD}Content${W}"
  echo "   1) Edit demo  (patches 3 fields, snapshots originals)"
  echo "   2) Undo demo  (restores all fields from snapshot)"
  echo ""
  echo -e "  ${BOLD}Email${W}"
  echo "   3) General inquiry  (residential real estate, test contact)"
  echo "   4) Priority inquiry (civil litigation, urgent matter)"
  echo ""
  echo -e "  ${BOLD}Calendar${W}"
  echo "   5) Full round-trip  (add → list → delete)"
  echo ""
  echo "   q) Quit"
  echo ""
  read -rp "  → " choice

  case "$choice" in
    1) demo_content_edit ;;
    2) demo_undo ;;
    3) demo_email_general ;;
    4) demo_email_priority ;;
    5) demo_calendar ;;
    q|Q) echo ""; exit 0 ;;
    *) echo -e "${R}  Invalid choice${W}" ;;
  esac

  read -rp "  Press Enter to continue..." _
done