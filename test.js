const https = require('https');
https.get('https://en.wikipedia.org/wiki/OSIRIS-REx', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^"']+/g);
    console.log([...new Set(matches)].slice(0, 5));
  });
});
