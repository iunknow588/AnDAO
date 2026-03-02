#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

contains_real_value() {
  local line="$1"
  local lower
  lower="$(printf '%s' "$line" | tr '[:upper:]' '[:lower:]')"

  if printf '%s' "$lower" | grep -Eq \
    '(your_|example|sample|placeholder|changeme|dummy|test_|_test|mock|fake|to_be_filled|xxxxx|^\s*$)'; then
    return 1
  fi

  if printf '%s' "$lower" | grep -Eq '0x(0{64}|1{64}|a{64}|b{64}|1234567890123456789012345678901234567890123456789012345678901234)'; then
    return 1
  fi

  return 0
}

should_skip_file() {
  local file="$1"
  if printf '%s' "$file" | grep -Eq \
    '(^|/)(__tests__|test|tests)/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$|\.example$|\.sample$|\.md$'; then
    return 0
  fi
  return 1
}

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
if [ -z "$staged_files" ]; then
  exit 0
fi

issues=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  if printf '%s' "$file" | grep -Eq '(^|/)\.env($|\.|/)|(^|/)env\.local$'; then
    printf "${RED}[BLOCK] 禁止提交本地环境文件: %s${NC}\n" "$file"
    issues=1
    continue
  fi

  should_skip_file "$file" && continue

  staged_content="$(git show ":$file" 2>/dev/null || true)"
  [ -z "$staged_content" ] && continue

  key_lines="$(printf '%s' "$staged_content" | grep -nE '(PRIVATE_KEY|MNEMONIC|SEED_PHRASE|SEED|SECRET|API_KEY|TOKEN)\s*[:=]' || true)"
  if [ -n "$key_lines" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      if contains_real_value "$line"; then
        printf "${RED}[BLOCK] 发现疑似真实密钥配置 (%s): %s${NC}\n" "$file" "$line"
        issues=1
      fi
    done <<< "$key_lines"
  fi

  pk_lines="$(printf '%s' "$staged_content" | grep -nE '0x[a-fA-F0-9]{64}' || true)"
  if [ -n "$pk_lines" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      if printf '%s' "$line" | grep -Eqi '(private|key|mnemonic|seed|secret|wallet)'; then
        if contains_real_value "$line"; then
          printf "${RED}[BLOCK] 发现疑似私钥泄露 (%s): %s${NC}\n" "$file" "$line"
          issues=1
        fi
      fi
    done <<< "$pk_lines"
  fi
done <<< "$staged_files"

if [ "$issues" -ne 0 ]; then
  printf "${YELLOW}提交已阻止：请移除或替换敏感值后重试。${NC}\n"
  exit 1
fi

exit 0
