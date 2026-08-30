#!/usr/bin/env bash
set -euo pipefail

npm ci --include=dev --no-audit --no-fund
npm run build