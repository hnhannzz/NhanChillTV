#!/usr/bin/env bash
# Legacy wrapper - delegates to the unified install script
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "[INFO] install-debian13.sh now redirects to install.sh (supports Debian 12+ and Ubuntu 24.04+)"
exec bash install.sh "$@"
