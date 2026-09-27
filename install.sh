#!/bin/sh
# Downloads docker-compose.yml and .env into the current directory.
# Usage: curl -fsSL https://raw.githubusercontent.com/hawkinslabdev/ha_energydisplay/HEAD/install.sh | sh
set -e

BASE=https://raw.githubusercontent.com/hawkinslabdev/ha_energydisplay/HEAD

fetch() {
  if [ -e "$2" ]; then
    printf '%s exists. Overwrite? [y/N] ' "$2"
    read -r answer < /dev/tty
    case "$answer" in [yY]*) ;; *) echo "Kept $2"; return ;; esac
  fi
  curl -fsSL "$BASE/$1" -o "$2"
  echo "Saved $2"
}

fetch docker-compose.yml docker-compose.yml
fetch .env.example .env

echo "Edit .env, then run: docker compose up -d"
