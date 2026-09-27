<p align="center">
  <img src="docs/icon.svg" alt="Logo" width="120" height="120">
</p>

<h1 align="center">Energy Display for Home Assistant</h1>

<p align="center">
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/hawkinslabdev/ha_energydisplay/tests.yml?branch=main&label=tests" alt="Tests"></a>
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

Settings are read from `.env`. `HA_URL` and `HA_TOKEN` are required; entities come from autodiscovery, environment variables, or both.

<details>
<summary>Connection</summary>

<br>

| Variable | Description |
| --- | --- |
| `HA_URL` | Home Assistant base URL, e.g. `http://homeassistant.local:8123` |
| `HA_TOKEN` | Long-lived access token |
| `TZ` | Time zone that defines midnight for daily totals, e.g. `Europe/Amsterdam` |
| `FRAME_ANCESTORS` | Extra origins allowed to embed the display in an iframe, space- or comma-separated. `HA_URL`'s origin is always allowed. |

</details>

<details>
<summary>Autodiscovery</summary>

<br>

Autodiscovery is on by default (`AUTODISCOVER=false` disables it) and reads entities from Home Assistant once per container start:

| Value | Source |
| --- | --- |
| Grid import and export, solar, gas, water, battery state of charge, battery energy in and out, gas price, gas and electricity cost statistics | Energy dashboard |
| Power | Energy dashboard grid power; otherwise the power sensor on the grid import meter's device |
| Temperature | `weather.forecast_*` entity, otherwise the first `weather.*` entity |

Entity variables that are set override discovered values. Changes to the Energy dashboard apply after a container restart. When discovery fails, for example without an Energy dashboard, a warning is logged and only entity variables are used.

</details>

<details>
<summary>Entities</summary>

<br>

| Variable | Description |
| --- | --- |
| `POWER` | Current power sensor (W or kW) |
| `ENERGY_IMPORT` | Total imported energy sensor (kWh or Wh) |
| `ENERGY_EXPORT` | Total exported energy sensor (kWh or Wh) |
| `SOLAR` | Total or daily solar production sensor (kWh or Wh) |
| `GAS` | Total gas sensor (m³) |
| `WATER` | Total water sensor (m³ or L; m³ is converted to L) |
| `TEMPERATURE` | Temperature sensor (°C), or a `weather.*` entity (reads its `temperature` attribute) |
| `BATTERY` | Battery state of charge sensor (%). |
| `GAS_PRICE` | Gas price per m³, used for today's gas cost when Home Assistant has no gas cost statistics |

Entity variables accept a comma-separated list; values are summed (e.g. `ENERGY_IMPORT=sensor.import_t1,sensor.import_t2`). Values that are not valid entity IDs are ignored and logged.

Daily totals are the sum of hourly `change` values from Home Assistant long-term statistics since midnight, matching the Energy dashboard. Totals cover completed hours only and update on the hour. Configured sensors require a `state_class` (`total` or `total_increasing`) to have statistics.

Gauge scales come from daily statistics of the last 30 days and the same date last year ±15 days. Daily totals use twice the median day, so a half-filled gauge is a typical day. Power uses the highest value reached. Without statistics, fixed defaults apply.

</details>

<details>
<summary>Wheels and bars</summary>

<br>

| Variable | Position | Default |
| --- | --- | --- |
| `WHEEL1` | Large wheel | `power` |
| `WHEEL2` | Top small wheel | `water` |
| `WHEEL3` | Bottom small wheel | `gas` |
| `BAR1` | First bar | `gas_cost` |
| `BAR2` | Second bar | `solar` |
| `BAR3` | Third bar | `temperature` |
| `BAR4` | Fourth bar | `battery` |

| Value | Shows | Requires |
| --- | --- | --- |
| `power` | Current power (W) | `POWER` |
| `water` | Water usage today (L) | `WATER` |
| `gas` | Gas usage today (m³) | `GAS` |
| `grid` | Grid neutrality: net imported from (positive) or exported to (negative) the grid today (kWh) | `ENERGY_IMPORT`, `ENERGY_EXPORT` |
| `solar` | Solar production today (kWh) | `SOLAR` |
| `self_consumption` | Self-consumed solar energy today (%), as in the Energy dashboard gauge. Battery flows require autodiscovery. | `SOLAR`, `ENERGY_EXPORT` |
| `self_sufficiency` | Self-sufficiency today (%), as in the Energy dashboard gauge. Battery flows require autodiscovery. | `ENERGY_IMPORT`, `SOLAR` |
| `gas_cost` | Gas cost today (€), from Home Assistant cost statistics or `GAS` × `GAS_PRICE` | `GAS` |
| `electricity_cost` | Grid import cost minus export compensation today (€), from Home Assistant cost statistics | Grid prices in the Energy dashboard |
| `temperature` | Current temperature (°C) | `TEMPERATURE` |
| `battery` | Battery state of charge (%) | `BATTERY` |

Every value works in every position. An unset or unknown value uses the position's default. A default whose entities are not configured is replaced by the first configured option not already shown. A bar whose entities are not configured is hidden.

</details>

## Troubleshooting

<details>
<summary>Values shown as a dash</summary>

<br>

A dash (`–`) marks a value without a configured entity, or with an entity that has no numeric state. `/api/state` lists both:

- `entities`: entity IDs in use per value, from environment variables or autodiscovery.
- `unavailable`: entity IDs without a numeric state in Home Assistant.

</details>

<details>
<summary>Connection errors</summary>

<br>

An unreachable host, a rejected token, or a timeout (10 seconds) returns HTTP 502 with a generic message, shown at the bottom of the display. The cause is in the container log:

```bash
docker compose logs energydisplay
```

</details>

## License

This project is licensed under EUPL 1.2.
