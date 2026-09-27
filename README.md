<p align="center">
  <img src="docs/icon.svg" alt="Logo" width="120" height="120">
</p>

<h1 align="center">Energy Display for Home Assistant</h1>

<p align="center">
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/actions/workflows/docker.yml"><img src="https://img.shields.io/github/actions/workflow/status/hawkinslabdev/ha_energydisplay/docker.yml?branch=main&label=docker" alt="Docker"></a>
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/pkgs/container/ha_energydisplay"><img src="https://img.shields.io/badge/ghcr.io-amd64%20%7C%20arm64-2496ED?logo=docker&logoColor=white" alt="Container"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-EUPL--1.2-blue.svg" alt="License"></a>
</p>

A self-hosted wall display for live power and daily energy, gas and water usage. Values come from Home Assistant entities, configured through environment variables.

![Energy Display](/docs/hero.png)

## Run

1. Create a long-lived access token in Home Assistant (**Profile** > **Security**).
2. Download `docker-compose.yml` and `.env`, set the Home Assistant URL, token and entity IDs in `.env`:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/hawkinslabdev/ha_energydisplay/HEAD/install.sh | sh
   ```
3. Start the dashboard with `docker compose up -d`.
4. Open http://localhost:9123.

## Configuration

| Variable | Description |
| --- | --- |
| `HA_URL` | Home Assistant base URL, e.g. `http://homeassistant.local:8123` |
| `HA_TOKEN` | Long-lived access token |
| `TZ` | Time zone that defines midnight for daily totals, e.g. `Europe/Amsterdam` |
| `AUTODISCOVER` | `true` reads power, grid import/export, solar production, gas, water, battery state of charge and gas price from the Home Assistant Energy dashboard. Entity variables that are set override discovered ones. Discovery runs once per container start. |
| `POWER` | Current power sensor (W) |
| `ENERGY_IMPORT` | Total imported energy sensor (kWh) |
| `ENERGY_EXPORT` | Total exported energy sensor (kWh) |
| `SOLAR` | Total or daily solar production sensor (kWh or Wh) |
| `GAS` | Total gas sensor (m³) |
| `WATER` | Total water sensor (m³ or L; m³ is converted to L) |
| `TEMPERATURE` | Temperature sensor (°C) |
| `BATTERY` | Battery state of charge sensor (%) |
| `GAS_PRICE` | Gas price per m³, used for today's gas cost |

Entity variables accept a comma-separated list; values are summed (e.g. `ENERGY_IMPORT=sensor.import_t1,sensor.import_t2`). An empty entity variable shows `0`. Daily usage is the current total minus the value at midnight, read from Home Assistant history. A total that drops below its midnight value is treated as reset, so sensors that reset daily also work.

## License

This project is licensed under EUPL 1.2.
