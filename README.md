<p align="center">
  <img src="docs/icon.svg" alt="Logo" width="120" height="120">
</p>

<h1 align="center">Local Energy Display</h1>

<p align="center">
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/hawkinslabdev/ha_energydisplay/tests.yml?branch=main&label=tests" alt="Tests"></a>
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/actions/workflows/docker.yml"><img src="https://img.shields.io/github/actions/workflow/status/hawkinslabdev/ha_energydisplay/docker.yml?branch=main&label=docker" alt="Docker"></a>
  <a href="https://github.com/hawkinslabdev/ha_energydisplay/pkgs/container/ha_energydisplay"><img src="https://img.shields.io/badge/ghcr.io-amd64%20%7C%20arm64-2496ED?logo=docker&logoColor=white" alt="Container"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-EUPL--1.2-blue.svg" alt="License"></a>
</p>

A self-hosted wall display for live power and daily energy, gas and water usage. It reads from Home Assistant or directly from a HomeWizard P1 Meter.

![Energy Display](/docs/hero.png)

## Run

1. For Home Assistant, create a long-lived access token (**Profile** > **Security**). For a HomeWizard P1 Meter, note its IP address.
2. Download `docker-compose.yml` and `.env`. The installer asks for the data source and its connection details:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/hawkinslabdev/ha_energydisplay/HEAD/install.sh | sh
   ```
3. Start the dashboard with `docker compose up -d`.
4. Open http://localhost:9123.

## Demo

`DEMO=true npm run build` builds a static export in `out/` with generated data that follows the time of day. `BASE_PATH` sets the URL prefix, e.g. `/ha_energydisplay`. `.github/workflows/pages.yml` publishes it to GitHub Pages on every push to `main`.

## Configuration

Settings are read from `.env`. `ADAPTER` selects the data source: Home Assistant (default) or a HomeWizard P1 Meter. Before you continue, make sure to setup the following section:

<b>General settings</b>

| Variable | Description |
| --- | --- |
| `ADAPTER` | `default` (alias `homeassistant`, `haos`) or `homewizard`. Unknown values use Home Assistant and are logged. |
| `TZ` | Time zone that defines midnight for daily totals, e.g. `Europe/Amsterdam` |
| `FRAME_ANCESTORS` | Additional origins allowed to embed the display in an iframe, space- or comma-separated. |

Based on your choice, you can change the settings per adapter:

<details>
<summary>Home Assistant</summary>

<br>

**Connection**

| Variable | Description |
| --- | --- |
| `HOMEASSISTANT_URL` | Home Assistant base URL, e.g. `http://homeassistant.local:8123`. Alias: `HA_URL`. |
| `HOMEASSISTANT_TOKEN` | Long-lived access token. Alias: `HA_TOKEN`. |

Both are required. Entities come from autodiscovery, entity variables, or both.

**Autodiscovery**

Autodiscovery is on by default (`AUTODISCOVER=false` disables it) and reads entities from Home Assistant once per container start:

| Value | Source |
| --- | --- |
| Grid import and export, solar, gas, water, battery state of charge, battery energy in and out, gas price, gas and electricity cost statistics | Energy dashboard |
| Power | Energy dashboard grid power; otherwise the power sensor on the grid import meter's device |
| Temperature | `weather.forecast_*` entity, otherwise the first `weather.*` entity |

Entity variables that are set override discovered values. Changes to the Energy dashboard apply after a container restart. Cost statistics start when a price is set in the Energy dashboard and are not backfilled. When discovery fails, for example without an Energy dashboard, a warning is logged and only entity variables are used.

**Entities**

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
| `ELECTRICITY_PRICE` | Price per kWh imported, used for today's electricity cost when Home Assistant has no grid cost statistics |
| `ELECTRICITY_COMPENSATION` | Price per kWh exported, subtracted from the electricity cost. Default: 0. |

Entity variables accept a comma-separated list; values are summed (e.g. `ENERGY_IMPORT=sensor.import_t1,sensor.import_t2`). Values that are not valid entity IDs are ignored and logged.

Daily totals are the sum of hourly `change` values from Home Assistant long-term statistics since midnight, matching the Energy dashboard. Totals cover completed hours only and update on the hour. Configured sensors require a `state_class` (`total` or `total_increasing`) to have statistics.

Gauge scales come from daily statistics of the last 30 days and the same date last year ±15 days. Daily totals use twice the median day, so a half-filled gauge is a typical day. Power uses the highest value reached. Without statistics, fixed defaults apply.

</details>

<details>
<summary>HomeWizard P1 Meter</summary>

<br>

`ADAPTER=homewizard` reads a HomeWizard P1 Meter directly, without Home Assistant.

| Variable | Description |
| --- | --- |
| `HOMEWIZARD_HOST` | IP address or hostname of the P1 Meter |
| `HOMEWIZARD_TOKEN` | API v2 token. Unset: API v1 over HTTP, which requires **Local API** in the HomeWizard app and is being phased out by HomeWizard. |
| `GAS_PRICE` | Gas price per m³, used for today's gas cost |
| `ELECTRICITY_PRICE`, `ELECTRICITY_COMPENSATION` | Price per kWh imported and exported, used for today's electricity cost. Compensation defaults to 0. |

API v2 token, after pressing the button on the P1 Meter:

```bash
curl -k -X POST https://<host>/api/user -H 'Content-Type: application/json' -H 'X-Api-Version: 2' -d '{"name":"local/energydisplay"}'
```

API v2 connections are verified against the HomeWizard CA certificate.

| Value | P1 Meter field |
| --- | --- |
| Power | `power_w` (v1: `active_power_w`) |
| Energy import and export | `energy_import_kwh`, `energy_export_kwh` (v1: `total_power_import_kwh`, `total_power_export_kwh`) |
| Gas | First `gas_meter` in `external` (v1 fallback: `total_gas_m3`) |
| Water | First `water_meter` in `external` |

Solar, temperature and battery have no P1 Meter source; their positions use the fallback described under [Wheels and bars](#configuration).

Daily totals are the current counter minus the last reading of the previous day, or the first reading of today, and include the current hour. Readings are stored per day in `DATA_DIR/homewizard.json` (`/data`, the `data` volume in `docker-compose.yml`) and give gauge scales as with Home Assistant statistics. Readings are taken while the display polls; power peaks cover those periods only. Without the volume, daily totals restart from the first reading after a container restart.

</details>

<br>

If you'd like to tweak the frontend, you can do so with the following settings:

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
| `electricity_cost` | Grid import cost minus export compensation today (€), from Home Assistant cost statistics or `ENERGY_IMPORT` × `ELECTRICITY_PRICE` − `ENERGY_EXPORT` × `ELECTRICITY_COMPENSATION` | `ENERGY_IMPORT` |
| `temperature` | Current temperature (°C) | `TEMPERATURE` |
| `battery` | Battery state of charge (%) | `BATTERY` |

Any value is valid in any position. An unset or unknown value uses the position's default. A default whose entities are not configured is replaced by the first configured option not already shown. A bar whose entities are not configured is hidden. Negative values, such as grid export or net compensation, fill in reverse.

</details>

## Troubleshooting


<details>
<summary>Having trouble connecting?</summary>

<br>

If the host is unreachable, your token is rejected, or the connection times out (after 10 seconds), you'll see a 502 error and a quick error message at the bottom of the screen. 

To see what actually went wrong under the hood, check the container logs:

```bash
docker compose logs energydisplay
```

</details>

<details>
<summary>Why is there a dash instead of a number?</summary>

<br>

If you see a dash (`–`), it just means there’s no entity set up for that value, or the entity isn't sending back a number right now. 

You can check what’s going on using the `/api/state` endpoint, which breaks down:

- `entities`: All the entity IDs currently attached to values (found via environment variables or autodiscovery).
- `unavailable`: Any entity IDs that Home Assistant can't get a valid numeric state for.

</details>

<details>
<summary>Can I change the adapter?</summary>

<br>

Yes. Set `ADAPTER` in `.env` and restart the container; the adapter is read once at startup:

```bash
docker compose up -d --force-recreate
```

`ADAPTER=homewizard` requires `HOMEWIZARD_HOST`. The P1 Meter has no solar, temperature or battery source: positions that default to these show another available value, and positions set to these explicitly show a dash (wheels) or are hidden (bars).

</details>

## License

This project is licensed under EUPL 1.2.
