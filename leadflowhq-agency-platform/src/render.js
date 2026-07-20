// src/render.js
// Minimal server-side HTML rendering helpers. No template engine dependency --
// just tagged template literals with HTML-escaping for user data.

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ title, user, active, body, flash }) {
  const nav = user
    ? `
    <header class="border-b border-slate-200 bg-white">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" class="font-bold text-lg text-slate-900">LeadFlow<span class="text-indigo-600">HQ</span></a>
        <nav class="flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="/dashboard" class="${active === 'overview' ? 'text-indigo-600' : 'hover:text-slate-900'}">Overview</a>
          <a href="/dashboard/clients" class="${active === 'clients' ? 'text-indigo-600' : 'hover:text-slate-900'}">Clients</a>
          <a href="/dashboard/settings" class="${active === 'settings' ? 'text-indigo-600' : 'hover:text-slate-900'}">Settings</a>
          <span class="text-slate-300">|</span>
          <span class="text-slate-500">${esc(user.name)}</span>
          <a href="/logout" class="text-slate-400 hover:text-red-600">Log out</a>
        </nav>
      </div>
    </header>`
    : '';

  const flashHtml = flash
    ? `<div class="max-w-6xl mx-auto px-6 mt-4"><div class="rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm px-4 py-3">${esc(flash)}</div></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · LeadFlowHQ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="data:,">
</head>
<body class="bg-slate-50 min-h-screen text-slate-900">
  ${nav}
  ${flashHtml}
  <main class="max-w-6xl mx-auto px-6 py-8">
    ${body}
  </main>
</body>
</html>`;
}

module.exports = { esc, layout };
