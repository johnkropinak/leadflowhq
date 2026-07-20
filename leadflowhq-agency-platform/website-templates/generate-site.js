#!/usr/bin/env node
// generate-site.js
// Usage: node generate-site.js <template-name> <config.json> <output-dir>
// Example: node generate-site.js local-service-pro example-config.json ./output/ace-plumbing
//
// Renders a template folder (index.html + styles.css) against a client
// config JSON, producing a ready-to-deploy static site (also emits
// robots.txt and sitemap.xml). Zero dependencies -- plain string templating.
const fs = require('node:fs');
const path = require('node:path');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function render(template, data) {
  // {{#each key}} ... {{this}} / {{this.field}} ... {{/each}}
  template = template.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (_, key, inner) => {
    const arr = data[key] || [];
    return arr.map((item) => {
      let chunk = inner;
      if (typeof item === 'object' && item !== null) {
        chunk = chunk.replace(/{{this\.(\w+)}}/g, (__, field) => escapeHtml(item[field]));
      } else {
        chunk = chunk.replace(/{{this}}/g, escapeHtml(item));
      }
      return chunk;
    }).join('');
  });
  // simple {{var}} (not HTML-escaped inside <script type="application/ld+json"> on purpose is fine
  // for demo data; replace with escapeHtml(...) if config values include user-submitted content)
  template = template.replace(/{{(\w+)}}/g, (_, key) => (data[key] !== undefined ? data[key] : ''));
  return template;
}

function main() {
  const [, , templateName, configPath, outDir] = process.argv;
  if (!templateName || !configPath || !outDir) {
    console.error('Usage: node generate-site.js <template-name> <config.json> <output-dir>');
    process.exit(1);
  }

  const templateDir = path.join(__dirname, templateName);
  if (!fs.existsSync(templateDir)) {
    console.error(`Template "${templateName}" not found in ${__dirname}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.year = config.year || new Date().getFullYear();

  fs.mkdirSync(outDir, { recursive: true });

  const htmlSrc = fs.readFileSync(path.join(templateDir, 'index.html'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');

  fs.writeFileSync(path.join(outDir, 'index.html'), render(htmlSrc, config));
  fs.writeFileSync(path.join(outDir, 'styles.css'), render(cssSrc, config));

  fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: https://${config.domain}/sitemap.xml\n`);
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${config.domain}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`);

  console.log(`Generated site for "${config.business_name}" -> ${outDir}`);
  console.log('Deploy this folder as a static site (e.g. Cloudflare Pages) and point your domain at it.');
}

main();
