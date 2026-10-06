// Turns the web build in dist/ into pc-preview/site/, a copy that works from any folder or address.
// Expo writes absolute paths (/assets/..., /_expo/...); this rewrites them to relative ones and
// flattens the asset folders so the preview can be served by the small script in pc-preview/.
// Usage: npm run build:web
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'pc-preview', 'site');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!fs.existsSync(dist)) {
  console.error('dist/ is missing. Run: npx expo export --platform web');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'a'), { recursive: true });

// 1. Assets (fonts and images) go into one flat folder, a/.
const assets = walk(path.join(dist, 'assets'));
for (const file of assets) fs.copyFileSync(file, path.join(out, 'a', path.basename(file)));

// 2. The script bundle: point every "/assets/<path>/<file>" at "a/<file>".
const jsDir = path.join(dist, '_expo', 'static', 'js', 'web');
const bundles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (bundles.length !== 1) {
  console.error(`Expected one script bundle, found ${bundles.length}.`);
  process.exit(1);
}
let js = fs.readFileSync(path.join(jsDir, bundles[0]), 'utf8');
let rewritten = 0;
js = js.replace(/"\/assets\/([^"]+)"/g, (_, assetPath) => {
  rewritten += 1;
  return `"a/${path.posix.basename(assetPath)}"`;
});
fs.writeFileSync(path.join(out, 'app.js'), js);
// The page asks for the script by a stamp of its contents, so a browser never keeps an old copy.
const stamp = require('crypto').createHash('md5').update(js).digest('hex').slice(0, 10);

// 3. A small page that loads the bundle with relative paths.
fs.copyFileSync(path.join(root, 'assets', 'favicon.png'), path.join(out, 'favicon.png'));
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>BillKul</title>
<link rel="icon" href="favicon.png">
<style>
html, body { height: 100%; margin: 0; background: #06130E; }
body { overflow: hidden; }
#root { display: flex; height: 100%; flex: 1; }
</style>
</head>
<body>
<noscript>BillKul needs JavaScript to run.</noscript>
<div id="root"></div>
<script src="app.js?v=${stamp}" defer></script>
</body>
</html>
`,
);

// 4. Plain pages that sit beside the app, such as the privacy policy at privacy/.
//    %ASSET:name% becomes the path of that font or image in a/.
const site = JSON.parse(fs.readFileSync(path.join(root, 'web', 'site.json'), 'utf8'));
const assetNames = assets.map((file) => path.basename(file));
function fillPage(html) {
  return html
    .replace(/%ASSET:([A-Za-z0-9_]+)%/g, (_, name) => {
      const file = assetNames.find((f) => f.startsWith(`${name}.`) && !/@\dx\./.test(f));
      if (!file) throw new Error(`No asset called ${name}`);
      return `../a/${file}`;
    })
    .replace(/%DATE%/g, site.policyDate)
    .replace(
      /%CONTACT%/g,
      site.contactEmail
        ? `Questions about this policy or about your data: <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>.`
        : "Questions about this policy or about your data: write to the developer email address shown on BillKul's page on Google Play.",
    );
}
fs.mkdirSync(path.join(out, 'privacy'), { recursive: true });
fs.writeFileSync(path.join(out, 'privacy', 'index.html'), fillPage(fs.readFileSync(path.join(root, 'web', 'privacy.html'), 'utf8')));

console.log(`pc-preview/site is ready: ${assets.length} assets, ${rewritten} paths rewritten, script ${(js.length / 1024).toFixed(0)} KB.`);
