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
2. Copy `.env.example` to `.env` and set the Home Assistant URL, token and entity IDs.
3. Start the container:

   ```bash
   docker compose up -d
   ```

4. Open http://localhost:8001.

## Configuration

| Variable | Description |
| --- | --- |
| `HA_URL` | Home Assistant base URL, e.g. `http://homeassistant.local:8123` |
| `HA_TOKEN` | Long-lived access token |
| `TZ` | Time zone that defines midnight for daily totals, e.g. `Europe/Amsterdam` |
| `POWER` | Current power sensor (W) |
| `ENERGY_IMPORT` | Total imported energy sensor (kWh) |
| `ENERGY_EXPORT` | Total exported energy sensor (kWh) |
| `GAS` | Total gas sensor (m³) |
| `WATER` | Total water sensor (m³ or L; m³ is converted to L) |
| `TEMPERATURE` | Temperature sensor (°C) |
| `BATTERY` | Battery state of charge sensor (%) |
| `GAS_PRICE` | Gas price per m³, used for today's gas cost |

An empty entity variable shows `0`. Daily usage is the current total minus the value at midnight, read from Home Assistant history.

## License

This project is licensed under EUPL 1.2.
