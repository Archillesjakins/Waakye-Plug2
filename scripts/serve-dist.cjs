// Tiny dependency-free static server for Waakye-Plug2/dist (preview/QA only).
// Usage: node scripts/serve-dist.cjs   ->   http://localhost:8899
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist'); // vite base '/' works under a real HTTP root at /assets/... OK 
const PORT = Number(process.argv[2]) || 8899;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

http.createServer(function(req, res) { // no traversal: join under ROOT then verify prefix 
  var u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; var file = path.normalize(path.join(ROOT, u)); if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); } fs.readFile(file, function(err, data) { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); }); }).listen(PORT,'127.0.0.1',function(){console.log('serving '+ROOT+' at http://localhost:'+PORT)}); 
