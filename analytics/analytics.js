const loginPanel = document.getElementById('loginPanel');
const dashboardPanel = document.getElementById('dashboardPanel');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const filtersForm = document.getElementById('filtersForm');
const numberFormat = new Intl.NumberFormat();
const sectionNames = {
  intro: 'Home',
  about: 'About',
  skills: 'Skills',
  projects: 'Work',
  designs: 'UI Lab',
  process: 'Process',
  contact: 'Contact'
};
const caseStudyNames = {
  'e-index-system': 'E-Index System',
  'essu-docuflow': 'ESSU DocuFlow',
  'rfid-library-system': 'RFID Library System',
  'sapao-coast-extensions': 'Sapao Coast'
};

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.dataset.error = String(isError);
}

function setDefaultDates() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  document.getElementById('rangeEnd').value = end.toISOString().slice(0, 10);
  document.getElementById('rangeStart').value = start.toISOString().slice(0, 10);
}

function labelFor(value) {
  if (sectionNames[value]) return sectionNames[value];
  if (value.startsWith('/#')) return sectionNames[value.slice(2)] || value;
  const caseStudy = value.match(/^\/case-study\/([^/]+)\//);
  if (caseStudy) return caseStudyNames[caseStudy[1]] || caseStudy[1];
  return value === '/' ? 'Home' : value;
}

function renderRanking(id, entries, labelFormatter = (value) => value) {
  const list = document.getElementById(id);
  list.replaceChildren();
  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'analytics-ranking';
    const label = document.createElement('span');
    label.className = 'analytics-ranking__label';
    label.textContent = labelFormatter(entry.label);
    const count = document.createElement('span');
    count.className = 'analytics-ranking__count';
    count.textContent = numberFormat.format(entry.views);
    item.append(label, count);
    list.appendChild(item);
  });
  if (!entries.length) {
    const item = document.createElement('li');
    item.className = 'analytics-muted';
    item.textContent = 'No activity in this date range.';
    list.appendChild(item);
  }
}

function formatBucketLabel(value, group) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (group === 'month') return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  if (group === 'week') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function renderChart(entries, group) {
  const chart = document.getElementById('visitorChart');
  const empty = document.getElementById('chartEmpty');
  chart.replaceChildren();
  const maxValue = Math.max(1, ...entries.flatMap((entry) => [entry.visitors, entry.views]));
  entries.forEach((entry, index) => {
    const column = document.createElement('div');
    column.className = 'analytics-chart__group';
    const bars = document.createElement('div');
    bars.className = 'analytics-chart__bars';
    [[entry.visitors, 'Visitors', ''], [entry.views, 'Page views', ' analytics-chart__bar--views']].forEach(([value, name, modifier]) => {
      const bar = document.createElement('span');
      bar.className = `analytics-chart__bar${modifier}`;
      bar.style.height = `${Math.max(1, Number(value) / maxValue * 100)}%`;
      bar.title = `${name}: ${numberFormat.format(value)}`;
      bars.appendChild(bar);
    });
    const label = document.createElement('span');
    label.className = 'analytics-chart__label';
    label.textContent = group === 'day' && index % 7 !== 0 ? '' : formatBucketLabel(entry.date, group);
    column.setAttribute('aria-label', `${formatBucketLabel(entry.date, group)}: ${numberFormat.format(entry.visitors)} visitors, ${numberFormat.format(entry.views)} page views`);
    column.append(bars, label);
    chart.appendChild(column);
  });
  empty.hidden = entries.some((entry) => entry.views > 0);
}

function renderActivity(entries) {
  const list = document.getElementById('activityList');
  list.replaceChildren();
  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'analytics-activity__item';
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = new Date(`${entry.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const label = document.createElement('span');
    label.textContent = `${entry.type === 'section' ? 'Section' : 'Page'} · ${labelFor(entry.label)}`;
    const count = document.createElement('span');
    count.className = 'analytics-activity__count';
    count.textContent = numberFormat.format(entry.count);
    item.append(date, label, count);
    list.appendChild(item);
  });
  if (!entries.length) {
    const item = document.createElement('li');
    item.className = 'analytics-muted';
    item.textContent = 'No activity in this date range.';
    list.appendChild(item);
  }
}

function fillChartGaps(data, start, end, group) {
  const counts = new Map(data.chart.map((entry) => [String(entry.date).slice(0, 10), entry]));
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (group === 'week') first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  if (group === 'month') first.setUTCDate(1);

  const buckets = [];
  for (const cursor = new Date(first); cursor <= last;) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = counts.get(key);
    buckets.push(entry || { date: key, visitors: 0, views: 0 });
    if (group === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (group === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

function renderDashboard(data, start, end, group) {
  [
    ['totalVisitors', data.total_visitors],
    ['totalViews', data.total_views],
    ['rangeVisitors', data.range_visitors],
    ['rangeViews', data.range_views],
    ['visitorsToday', data.visitors_today],
    ['visitorsThisWeek', data.visitors_this_week],
    ['visitorsThisMonth', data.visitors_this_month]
  ].forEach(([id, value]) => {
    document.getElementById(id).textContent = numberFormat.format(value);
  });
  document.getElementById('rangeVisitorsNote').textContent = `${start} to ${end}`;
  document.getElementById('rangeViewsNote').textContent = `${start} to ${end}`;
  renderChart(fillChartGaps(data, start, end, group), group);
  renderRanking('sectionsList', data.sections, (value) => sectionNames[value] || value);
  renderRanking('caseStudiesList', data.case_studies, labelFor);
  renderRanking('pagesList', data.pages, labelFor);
  renderRanking('sourcesList', data.sources);
  renderRanking('devicesList', data.devices);
  renderActivity(data.activity);
}

async function loadAnalytics() {
  const start = document.getElementById('rangeStart').value;
  const end = document.getElementById('rangeEnd').value;
  const group = document.getElementById('chartGroup').value;
  const url = new URL('/api/analytics', window.location.origin);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.set('group', group);
  setStatus(dashboardStatus, 'Loading analytics…');

  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 401) {
    dashboardPanel.hidden = true;
    loginPanel.hidden = false;
    return false;
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Analytics could not be loaded.');
  renderDashboard(data, start, end, group);
  setStatus(dashboardStatus, '');
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  return true;
}

async function checkSession() {
  setDefaultDates();
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    const session = await response.json();
    if (!response.ok) throw new Error(session.error || 'Sign-in could not be checked.');
    if (session.authenticated) await loadAnalytics();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus(loginStatus, 'Signing in…');
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: document.getElementById('ownerEmail').value,
        password: document.getElementById('ownerPassword').value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
    document.getElementById('ownerPassword').value = '';
    await loadAnalytics();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

filtersForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loadAnalytics();
  } catch (error) {
    setStatus(dashboardStatus, error.message, true);
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error('Sign-out failed.');
    dashboardPanel.hidden = true;
    loginPanel.hidden = false;
    setStatus(loginStatus, 'You have signed out.');
  } catch (error) {
    setStatus(dashboardStatus, error.message, true);
  }
});

checkSession();
