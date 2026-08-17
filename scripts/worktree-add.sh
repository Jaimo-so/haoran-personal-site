#!/usr/bin/env bash

set -euo pipefail

BRANCH_NAME="${1:-}"
BASE_REF="${2:-main}"

if [[ -z "${BRANCH_NAME}" ]]; then
  echo "Usage: npm run worktree:add -- <branch-name> [base-ref]"
  echo "Example: npm run worktree:add -- feat/ask-ai-history"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_PARENT="$(dirname "${REPO_ROOT}")"
REPO_NAME="$(basename "${REPO_ROOT}")"
SAFE_BRANCH_NAME="${BRANCH_NAME//\//-}"
TARGET_DIR="${REPO_PARENT}/${REPO_NAME}-${SAFE_BRANCH_NAME}"

cd "${REPO_ROOT}"

if [[ -e "${TARGET_DIR}" ]]; then
  echo "Target directory already exists: ${TARGET_DIR}"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  git worktree add "${TARGET_DIR}" "${BRANCH_NAME}"
else
  git worktree add -b "${BRANCH_NAME}" "${TARGET_DIR}" "${BASE_REF}"
fi

echo
echo "Worktree created:"
echo "  branch: ${BRANCH_NAME}"
echo "  base:   ${BASE_REF}"
echo "  path:   ${TARGET_DIR}"
echo
echo "Next:"
echo "  cd ${TARGET_DIR}"
echo "  npm install   # if dependencies changed"
echo "  npm run verify"
