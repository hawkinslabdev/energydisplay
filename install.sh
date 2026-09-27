#!/bin/sh
# Downloads docker-compose.yml and .env into the current directory.
# Usage: curl -fsSL https://raw.githubusercontent.com/hawkinslabdev/energydisplay/HEAD/install.sh | sh
set -e

BASE=https://raw.githubusercontent.com/hawkinslabdev/energydisplay/HEAD/energydisplay

fetch() {
  if [ -e "$2" ]; then
    printf '%s exists. Overwrite? [y/N] ' "$2"
    read -r answer < /dev/tty
    case "$answer" in [yY]*) ;; *) echo "Kept $2"; return ;; esac
  fi
  curl -fsSL "$BASE/$1" -o "$2"
  echo "Saved $2"
}

# sets KEY=value in .env, replacing a set or commented line
set_env() {
  KEY="$1" VALUE="$2" awk '
    $0 ~ "^#? ?" ENVIRON["KEY"] "=" { if (!done) print ENVIRON["KEY"] "=" ENVIRON["VALUE"]; done = 1; next }
    { print }
    END { if (!done) print ENVIRON["KEY"] "=" ENVIRON["VALUE"] }
  ' .env > .env.tmp && mv .env.tmp .env
}

ask() {
  printf '%s' "$1" > /dev/tty
  read -r answer < /dev/tty
  echo "${answer:-$2}"
}

ask_secret() {
  printf '%s' "$1" > /dev/tty
  trap 'stty echo < /dev/tty' EXIT INT
  stty -echo < /dev/tty
  read -r answer < /dev/tty
  stty echo < /dev/tty
  echo > /dev/tty
  echo "$answer"
}

configure() {
  echo
  echo "Where should the display read its data from?"
  echo "  1) Home Assistant"
  echo "  2) HomeWizard P1 Meter"
  echo "  3) Skip, I'll edit .env myself"
  case "$(ask 'Choose 1, 2 or 3 [1]: ' 1)" in
    1)
      set_env ADAPTER default
      set_env HOMEASSISTANT_URL "$(ask 'Home Assistant URL [http://homeassistant.local:8123]: ' http://homeassistant.local:8123)"
      echo "Create a long-lived access token in Home Assistant under Profile > Security."
      set_env HOMEASSISTANT_TOKEN "$(ask_secret 'Access token: ')"
      ;;
    2)
      set_env ADAPTER homewizard
      set_env HOMEWIZARD_HOST "$(ask 'P1 Meter IP address or hostname: ')"
      token="$(ask_secret 'API v2 token (leave empty for API v1): ')"
      if [ -n "$token" ]; then set_env HOMEWIZARD_TOKEN "$token"; fi
      ;;
    *) echo "Skipped. Edit .env, then run: docker compose up -d"; return ;;
  esac
  echo "Saved .env. Start the display with: docker compose up -d"
}

fetch docker-compose.yml docker-compose.yml
fetch .env.example .env

# no terminal, e.g. in CI: leave .env as downloaded
if (exec < /dev/tty) 2>/dev/null; then
  configure
else
  echo "Edit .env, then run: docker compose up -d"
fi
