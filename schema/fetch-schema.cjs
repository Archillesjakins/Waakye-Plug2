const fs = require('fs');
const key = fs.readFileSync('C:/Users/user/supabase-cli/waakye-service.txt', 'utf8').trim();

fetch('https://verncapitxzsgcughvil.supabase.co/rest/v1/', {
  headers: { apikey: key, Authorization: 'Bearer ' + key },
})
  .then(async (r) => {
    const spec = await r.json();
    const tables = Object.keys(spec.paths).filter((p) => p !== '/');
    console.log('TABLES (' + tables.length + '):');
    tables.forEach((t) => console.log(' ', t));
    const outDir = 'C:/Users/user/Desktop/Waakye-Plug2/schema';
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outDir + '/openapi-spec.json', JSON.stringify(spec, null, 2));
    console.log('saved openapi-spec.json');
    // Save table list separately for quick reference
    fs.writeFileSync(outDir + '/tables.txt', tables.join('\n'));
  })
  .catch((e) => console.log('ERR', e.message));
