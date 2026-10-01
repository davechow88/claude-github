/**
 * Transit SG — CT Hub 2 → Thomson Plaza
 *
 * Uses LTA DataMall (datamall2.mytransport.sg):
 *   - BusArrivalV2: real-time arrivals for a bus stop
 *
 * The user provides their own free API key from
 * datamall.lta.gov.sg; nothing is hard-coded.
 */

// ── Config ──────────────────────────────────
const BUS_ARRIVAL_URL =
  'https://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2';

// Well-known bus stops near CT Hub 2 (Alexandra Rd area)
const ORIGIN_STOPS = [
  { code: '28049', name: 'Alexandra Rd (Tiong Bahru side)' },
  { code: '28051', name: 'Alexandra Rd (opp Tiong Bahru)' },
  { code: '28041', name: 'Alexandra Rd (Blk 116)' },
];

// Well-known bus stops near Thomson Plaza
const DEST_STOPS = [
  { code: '53059', name: 'Upper Thomson Rd (Thomson Plaza)' },
  { code: '53069', name: 'Upper Thomson Rd (opp Thomson Plaza)' },
  { code: '53091', name: 'Lornie Rd (before Upper Thomson)' },
];

const POLL_INTERVAL_MS = 30_000; // 30 s

// ── State ───────────────────────────────────
let apiKey = '';
let pollTimer = null;

// ── DOM refs ────────────────────────────────
const $keyScreen    = document.getElementById('key-screen');
const $appScreen    = document.getElementById('app-screen');
const $apiKeyInput  = document.getElementById('api-key');
const $keySubmit    = document.getElementById('key-submit');
const $themeToggle  = document.getElementById('transit-theme-toggle');
const $originBox    = document.getElementById('origin-stops');
const $destBox      = document.getElementById('dest-stops');
const $sharedSec    = document.getElementById('shared-section');
const $sharedCards  = document.getElementById('shared-cards');
const $jBest        = document.getElementById('j-best');
const $refreshBtn   = document.getElementById('refresh-btn');

// ── Theme handling (reuse root styles) ──────
function setTheme(theme) {
  document.documentElement.setAttribute(
    'data-theme',
    theme === 'dark' ? 'dark' : 'light'
  );
}

function initTransitTheme() {
  const saved = localStorage.getItem('transit-theme');
  const sys   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(saved ?? sys);
}

$themeToggle.addEventListener('click', () => {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem('transit-theme', next);
});

// ── API helper ──────────────────────────────
async function fetchArrivals(stopCode) {
  const res = await fetch(
    `${BUS_ARRIVAL_URL}?BusStopCode=${encodeURIComponent(stopCode)}`,
    { headers: { AccountKey: apiKey } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for stop ${stopCode}`);
  const data = await res.json();
  return data.Services || [];
}

// ── Time formatting ─────────────────────────
function fmtDuration(min) {
  if (min === null || min === undefined || isNaN(min)) return '–';
  if (min <= 1) return 'Arr';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function timeChipClass(min) {
  if (min === null || isNaN(min)) return '';
  if (min <= 5) return 'soon';
  if (min <= 15) return 'warning';
  return '';
}

function renderArrivals(services, container) {
  container.innerHTML = '';
  if (!services.length) {
    container.innerHTML = '<p class="empty">No upcoming buses found.</p>';
    return;
  }

  services.forEach(svc => {
    const next = svc.NextBus
      ? svc.NextBus.OriginCode
        ? svc.NextBus
        : null
      : null;

    const times = [
      svc.NextBus    && svc.NextBus.OriginCode    ? svc.NextBus.Est_Arrival    : null,
      svc.NextBus2   && svc.NextBus2.OriginCode   ? svc.NextBus2.Est_Arrival   : null,
      svc.NextBus3   && svc.NextBus3.OriginCode   ? svc.NextBus3.Est_Arrival   : null,
    ]
      .filter(Boolean)
      .map(mins => {
        if (!mins) return null;
        const now = Date.now();
        const eta = new Date(mins).getTime();
        return Math.max(0, Math.round((eta - now) / 60_000));
      })
      .filter(m => m !== null && !isNaN(m));

    if (!times.length && !next) return;

    const chips = times
      .slice(0, 3)
      .map(t => `<span class="time-chip ${timeChipClass(t)}">${fmtDuration(t)}</span>`)
      .join('');

    const typeBadge = svc.ServiceType === 'EXPRESS'
      ? '<span class="bus-type-badge">EXPRESS</span>'
      : '';

    const card = document.createElement('div');
    card.className = 'arrival-card';
    card.innerHTML = `
      <div class="bus-number">${svc.ServiceNo}</div>
      <div class="arrival-details">
        <div class="bus-desc">${svc.Operator}${typeBadge}</div>
        <div class="arrival-times">${chips || '<span class="time-chip">No estimate</span>'}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ── Main load ───────────────────────────────
async function loadArrivals() {
  $refreshBtn.disabled = true;
  $refreshBtn.textContent = '…';

  try {
    // Fetch arrivals for origin and destination stops in parallel
    const originResults = await Promise.all(
      ORIGIN_STOPS.map(s => fetchArrivals(s.code).catch(() => []))
    );
    const destResults = await Promise.all(
      DEST_STOPS.map(s => fetchArrivals(s.code).catch(() => []))
    );

    // Render origin stops
    ORIGIN_STOPS.forEach((stop, i) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<p class="stop-address" style="margin-bottom:.5rem;font-size:.8rem;">${stop.name} <code style="opacity:.6">${stop.code}</code></p>`;
      const div = document.createElement('div');
      wrapper.appendChild(div);
      $originBox.appendChild(wrapper);
      renderArrivals(originResults[i], div);
    });

    // Render destination stops
    DEST_STOPS.forEach((stop, i) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<p class="stop-address" style="margin-bottom:.5rem;font-size:.8rem;">${stop.name} <code style="opacity:.6">${stop.code}</code></p>`;
      const div = document.createElement('div');
      wrapper.appendChild(div);
      $destBox.appendChild(wrapper);
      renderArrivals(destResults[i], div);
    });

    // Cross-match shared bus services
    const originServices = new Map();
    originResults.forEach(arr => {
      arr.forEach(svc => originServices.set(svc.ServiceNo, svc));
    });
    const destServices = new Map();
    destResults.forEach(arr => {
      arr.forEach(svc => destServices.set(svc.ServiceNo, svc));
    });

    const shared = [...originServices.keys()].filter(s => destServices.has(s));

    if (shared.length) {
      $sharedSec.style.display = '';
      $sharedCards.innerHTML = '';
      shared.forEach(svcNo => {
        const from = originServices.get(svcNo);
        const to   = destServices.get(svcNo);

        const card = document.createElement('div');
        card.className = 'arrival-card';
        card.innerHTML = `
          <div class="bus-number">${svcNo}</div>
          <div class="arrival-details">
            <div class="bus-desc">Available from both stops</div>
          </div>
        `;
        card.addEventListener('click', () => {
          $jBest.textContent = `Bus ${svcNo}`;
        });
        $sharedCards.appendChild(card);
      });
      $jBest.textContent = `Bus ${shared[0]}${shared.length > 1 ? ` (+${shared.length - 1} more)` : ''}`;
    } else {
      $jBest.textContent = 'Transfer recommended';
    }
  } catch (err) {
    console.error(err);
    $originBox.innerHTML = `<p class="empty" style="color:#ef4444">Error: ${err.message}</p>`;
  } finally {
    $refreshBtn.disabled = false;
    $refreshBtn.textContent = '↻ Refresh';
  }
}

// ── Boot ────────────────────────────────────
$keySubmit.addEventListener('click', () => {
  const key = $apiKeyInput.value.trim();
  if (!key) {
    $apiKeyInput.focus();
    return;
  }
  apiKey = key;

  $keyScreen.classList.remove('active');
  $appScreen.classList.add('active');
  initTransitTheme();
  loadArrivals();

  pollTimer = setInterval(loadArrivals, POLL_INTERVAL_MS);
});

$refreshBtn.addEventListener('click', loadArrivals);
