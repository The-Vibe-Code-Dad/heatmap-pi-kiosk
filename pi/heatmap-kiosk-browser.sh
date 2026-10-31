#!/usr/bin/env bash
set -euo pipefail

URL="${HEATMAP_KIOSK_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${HEALTH_URL:-${URL}/api/health}"
COG_BIN="${COG_BIN:-}"
CAGE_BIN="${CAGE_BIN:-}"
LOADING_LOGO_PATH="${HEATMAP_LOADING_LOGO_PATH:-/opt/heatmap-pi-kiosk/public/logo-loading.png}"

if [[ -z "${COG_BIN}" ]]; then
  if command -v cog >/dev/null 2>&1; then
    COG_BIN="cog"
  else
    echo "Cog is not installed." >&2
    exit 1
  fi
fi

if [[ -z "${CAGE_BIN}" ]]; then
  if [[ -x /usr/local/bin/cage ]]; then
    CAGE_BIN="/usr/local/bin/cage"
  elif command -v cage >/dev/null 2>&1; then
    CAGE_BIN="cage"
  else
    echo "Cage is not installed." >&2
    exit 1
  fi
fi

wait_for_app() {
  curl --silent --show-error --fail --max-time 2 "${HEALTH_URL}" >/dev/null
}

startup_loading_url() {
  local loading_page
  local logo_markup=""

  if [[ -r "${LOADING_LOGO_PATH}" ]]; then
    logo_markup="<img class=\"logo\" src=\"data:image/png;base64,$(base64 "${LOADING_LOGO_PATH}" | tr -d '\n')\" alt=\"\" />"
  fi

  loading_page=$(cat <<HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="app-url" content="${URL}" />
    <meta name="health-url" content="${HEALTH_URL}" />
    <title>Starting Heat Map Kiosk</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        background: #03070d;
        color: #f1f7ff;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        cursor: none;
      }

      body {
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .startup {
        width: min(86vw, 520px);
        display: grid;
        gap: 13px;
        justify-items: center;
        text-align: center;
      }

      .logo {
        width: clamp(68px, 18vw, 104px);
        height: clamp(68px, 18vw, 104px);
        object-fit: contain;
      }

      h1 {
        margin: 0;
        color: #f5fbff;
        font-size: 1.8rem;
      }

      p {
        margin: 0;
        color: #a9c3dc;
        font-size: 1rem;
      }

      .bar {
        width: min(78vw, 420px);
        height: 12px;
        overflow: hidden;
        border: 1px solid rgba(92, 167, 230, 0.42);
        background: #07111b;
      }

      .bar span {
        display: block;
        width: 6%;
        height: 100%;
        background: linear-gradient(90deg, #35d36c, #86cbff);
        transition: width 0.35s ease;
      }

      .meter {
        color: #d7ecff;
        font-size: 1.15rem;
        font-weight: 800;
      }

      .detail {
        min-height: 1.3em;
        color: #7897b5;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main class="startup">
      ${logo_markup}
      <h1>Starting Heat Map Kiosk</h1>
      <div class="meter" id="percent">6%</div>
      <div class="bar" aria-hidden="true"><span id="bar-fill"></span></div>
      <p id="status">Starting kiosk app...</p>
      <p class="detail" id="detail">Checking display and local app service.</p>
    </main>
    <script>
      (() => {
        const appUrl = document.querySelector('meta[name="app-url"]').content;
        const healthUrl = document.querySelector('meta[name="health-url"]').content;
        const fill = document.querySelector("#bar-fill");
        const percent = document.querySelector("#percent");
        const status = document.querySelector("#status");
        const detail = document.querySelector("#detail");
        const startedAt = Date.now();
        let attempts = 0;

        function elapsedSeconds() {
          return Math.floor((Date.now() - startedAt) / 1000);
        }

        function updateProgress(value, message, extra) {
          const clamped = Math.max(6, Math.min(100, Math.round(value)));
          fill.style.width = clamped + "%";
          percent.textContent = clamped + "%";
          status.textContent = message;
          detail.textContent = extra;
        }

        function loadingStage() {
          const elapsed = elapsedSeconds();
          const slowProgress = Math.min(92, 8 + elapsed * 2 + attempts * 3);

          if (elapsed < 5) {
            return [slowProgress, "Starting local kiosk service...", "Waiting for Node to open the heat map app."];
          }

          if (elapsed < 20) {
            return [slowProgress, "Checking app health endpoint...", healthUrl];
          }

          if (elapsed < 60) {
            return [slowProgress, "Loading board assets and settings...", "The app server has not answered yet."];
          }

          if (elapsed < 180) {
            return [Math.min(96, slowProgress), "Waiting for heatmap-app.service...", "Health check is still not reachable after " + elapsed + " seconds."];
          }

          return [99, "App service is not responding.", "Reboot or check heatmap-app.service logs; the kiosk runtime is still retrying."];
        }

        function probe() {
          attempts += 1;
          updateProgress(...loadingStage());

          fetch(healthUrl + (healthUrl.includes("?") ? "&" : "?") + "startup=" + Date.now(), {
            cache: "no-store",
            mode: "no-cors"
          })
            .then(() => {
              updateProgress(100, "App is ready.", "Opening the heat map board now.");
              setTimeout(() => window.location.replace(appUrl), 150);
            })
            .catch(() => setTimeout(probe, 1200));
        }

        function imageFallbackProbe() {
          const image = new Image();
          const timeout = setTimeout(() => {
            image.onload = null;
            image.onerror = null;
            setTimeout(imageFallbackProbe, 1600);
          }, 1800);

          image.onload = () => {
            clearTimeout(timeout);
            updateProgress(100, "App is ready.", "Opening the heat map board now.");
            window.location.replace(appUrl);
          };

          image.onerror = () => {
            clearTimeout(timeout);
            setTimeout(imageFallbackProbe, 1600);
          };

          image.src = appUrl.replace(/\\/$/, "") + "/logo.png?startup=" + Date.now();
        }

        probe();
        setTimeout(imageFallbackProbe, 800);
      })();
    </script>
  </body>
</html>
HTML
)

  printf 'data:text/html;base64,%s' "$(printf '%s' "${loading_page}" | base64 | tr -d '\n')"
}

export XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-wayland}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/heatmap-kiosk}"
export XCURSOR_THEME="${XCURSOR_THEME:-heatmap-blank-cursor}"
export XCURSOR_SIZE="${XCURSOR_SIZE:-16}"
export WLR_NO_HARDWARE_CURSORS="${WLR_NO_HARDWARE_CURSORS:-1}"

if wait_for_app; then
  START_URL="${URL}"
else
  START_URL="$(startup_loading_url)"
fi

exec "${CAGE_BIN}" -c -d -- "${COG_BIN}" \
  --platform=wl \
  --bg-color="#03070d" \
  --webprocess-failure=restart \
  "${START_URL}"
