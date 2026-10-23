// NASA Science contract: OPTIONS /wp-json/wp/v2/apod-basic was verified live.
// Synthetic prose and a tiny local PNG; no production content or credentials.
const http = require('http');
const root = 'http://127.0.0.1:4911/nasa';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGPksoliYGBgYgADAAdaAKRzCbHKAAAAAElFTkSuQmCC', 'base64');
const entries = [23, 22, 21].map(day => ({
  date: `2026-10-${day}`, title: `A planet &amp; stars ${day}`,
  permalink: `${root}/image-article/${day}/`, url: `${root}/image-article/${day}/`,
  hdurl: `${root}/image.png`, media_type: day === 22 ? 'video' : 'image',
  explanation: '<strong>Explanation:</strong> A detailed synthetic observation describes a planet and the surrounding stars for this local test.<br><br><strong>Tomorrow\'s picture:</strong> Another observation',
  copyright: '<a href="https://example.com">Test Photographer</a>',
  basic_html: day === 22 ? '<iframe src="//www.youtube.com/embed/DzrCEm1ZBRY?rel=0"></iframe>' : `<img src="${root}/image.png">`
}));
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/image.png') { res.writeHead(200, {'Content-Type': 'image/png'}); return res.end(png); }
  if (u.pathname === '/broken.jpg') { res.writeHead(503, {'Content-Type': 'text/html'}); return res.end('<html>Media unavailable</html>'); }
  if (u.pathname === '/unavailable') { res.writeHead(500, {'Content-Type': 'application/json'}); return res.end(JSON.stringify({code:500,msg:'Internal Service Error'})); }
  if (u.pathname === '/apod-basic') {
    if (u.searchParams.has('api_key') || u.searchParams.has('start_date') || u.searchParams.has('thumbs')) { res.writeHead(400); return res.end('{}'); }
    let rows = entries;
    if (u.searchParams.has('date_from')) {
      const from = u.searchParams.get('date_from'), to = u.searchParams.get('date_to');
      if (!/^\d{6}$/.test(from || '') || !/^\d{6}$/.test(to || '')) { res.writeHead(400); return res.end('{}'); }
      rows = rows.filter(e => e.date.replaceAll('-', '').slice(2) >= from && e.date.replaceAll('-', '').slice(2) <= to);
    }
    // Exercise pagination even when the client asks for 60 records.
    const size = Math.min(Number(u.searchParams.get('per_page') || 25), 2);
    const page = Number(u.searchParams.get('page') || 1);
    res.writeHead(200, {'Content-Type':'application/json','X-WP-TotalPages':String(Math.max(1,Math.ceil(rows.length/size)))});
    return res.end(JSON.stringify(rows.slice((page-1)*size,page*size)));
  }
  res.writeHead(501); res.end('Not modeled');
}).listen(process.env.PORT);
