#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
trap 'printf "\nSetup stopped. Fix the error above, then rerun bash setup.sh.\n" >&2' ERR
command -v node >/dev/null || { echo 'Install Node.js 22.12+ first.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm is required.' >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<12)){console.error("Node.js 22.12+ required");process.exit(1)}'
echo 'MySQL must already be running. Create an EMPTY database first; see README.fa.md.'
if [[ "${1:-}" != '--skip-install' ]]; then npm ci --no-audit --no-fund; fi
if [[ ! -f .env ]]; then npm run setup:env; else echo 'Existing .env preserved.'; fi
npm run db:generate
npm run db:deploy
npm run db:admin -- --if-missing
npm run typecheck
npm run build
printf '\nSetup complete. Run: npm start -- --hostname 127.0.0.1\nOpen http://localhost:3000\n'
