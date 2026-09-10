const fs = require('fs');
const https = require('https');
const path = require('path');

const missions = [
  { name: 'osirisrex', url: 'https://en.wikipedia.org/wiki/OSIRIS-REx' },
  { name: 'kepler', url: 'https://en.wikipedia.org/wiki/Kepler_space_telescope' },
  { name: 'spitzer', url: 'https://en.wikipedia.org/wiki/Spitzer_Space_Telescope' },
  { name: 'pioneer10', url: 'https://en.wikipedia.org/wiki/Pioneer_10' },
  { name: 'pioneer11', url: 'https://en.wikipedia.org/wiki/Pioneer_11' }
];

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  for (const m of missions) {
    console.log('Fetching', m.name);
    const html = await new Promise((resolve) => {
      https.get(m.url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
    });
    
    // Find infobox image
    const match = html.match(/class="infobox-image"[^>]*>.*?<img[^>]*src="\/\/(upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^"]+)"/s);
    if (match) {
      let imgUrl = 'https://' + match[1];
      // Replace thumb URL to get full image, or just use the thumb if it's large enough.
      // Usually thumb is 220px or 300px. Let's get the original by removing /thumb/ and the trailing /<width>px-....
      let origUrl = imgUrl.replace(/\/thumb\//, '/').replace(/\/[^\/]+px-[^\/]+$/, '');
      console.log('Found URL:', origUrl);
      
      const dest = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'public', m.name, 'images', m.name + '_probe.jpg');
      await downloadImage(origUrl, dest);
      console.log('Downloaded', m.name);
    } else {
      console.log('No image found for', m.name);
    }
  }
}

run();
