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
| `AUTODISCOVER` | `true` reads power, grid import/export, solar production, gas, water, battery state of charge and gas price from the Home Assistant Energy dashboard, and temperature from a `weather.*` entity (`weather.forecast_*` preferred). Entity variables that are set override discovered ones. Discovery runs once per container start. |
| `POWER` | Current power sensor (W) |
| `ENERGY_IMPORT` | Total imported energy sensor (kWh) |
| `ENERGY_EXPORT` | Total exported energy sensor (kWh) |
| `SOLAR` | Total or daily solar production sensor (kWh or Wh) |
| `GAS` | Total gas sensor (m³) |
| `WATER` | Total water sensor (m³ or L; m³ is converted to L) |
| `TEMPERATURE` | Temperature sensor (°C), or a `weather.*` entity (reads its `temperature` attribute) |
| `BATTERY` | Battery state of charge sensor (%). The battery tile is hidden when no battery is configured. |
| `GAS_PRICE` | Gas price per m³, used for today's gas cost |
| `WHEEL1` | Large wheel. Default `power` |
| `WHEEL2` | Top small wheel. Default `water` |
| `WHEEL3` | Bottom small wheel. Default `gas` |
| `FRAME_ANCESTORS` | Extra origins allowed to embed the display in an iframe, space- or comma-separated. `HA_URL`'s origin is always allowed. |

Wheel values:

| Value | Shows | Requires |
| --- | --- | --- |
| `power` | Current power (W) | `POWER` |
| `water` | Water usage today (L) | `WATER` |
| `gas` | Gas usage today (m³) | `GAS` |
| `grid` | Net grid today: import minus export (kWh) | `ENERGY_IMPORT`, `ENERGY_EXPORT` |
| `solar` | Solar production today (kWh) | `SOLAR` |
| `self_consumption` | Solar production not exported, as a share of production today (%) | `SOLAR`, `ENERGY_EXPORT` |

An unset or unknown value uses the wheel's default. A default whose entities are not configured is replaced by the first configured option not already shown.

Entity variables accept a comma-separated list; values are summed (e.g. `ENERGY_IMPORT=sensor.import_t1,sensor.import_t2`). A dash (`–`) marks a value that is not configured or unavailable in Home Assistant. Daily usage is the current total minus the value at midnight, read from Home Assistant history. A total that drops below its midnight value is treated as reset, so sensors that reset daily also work.

## Troubleshooting

`/api/state` returns the readings plus:

- `entities`: entity IDs in use per value, from environment variables or autodiscovery.
- `unavailable`: entity IDs without a numeric state in Home Assistant.

A value shown as `–` has no entity in `entities`, or its entity is listed in `unavailable`. Home Assistant errors (unreachable host, rejected token, timeouts) return HTTP 502 with a generic message; the cause is in the container log (`docker compose logs energydisplay`).

## License

This project is licensed under EUPL 1.2.
