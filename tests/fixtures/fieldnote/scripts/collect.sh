#!/usr/bin/env bash
# Collect the last failing command and its output from the session history.
# Not -e: this script is diagnostic and reports what it finds either way.
set -u
tail -n 40 "${HISTFILE:-$HOME/.bash_history}" 2>/dev/null || echo "no history available"
