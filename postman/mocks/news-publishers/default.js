// Synthetic prose; publisher markup shapes reproduce the public pages/feed.
// No account or production records are used by this local-only dependency.
const http = require("http");
const prose = "Researchers have released a detailed new observation of an unusual planet.";
const article = `<!doctype html><html><head><meta content='/hero.jpg?w=800&amp;h=450' property='og:image'></head><body>
  <nav><p>Site navigation and promotional material must not become article prose.</p></nav>
  <article><div class='article-content'><p>${prose}</p>
    <div class='embed-container'><iframe src='https://www.youtube.com/embed/178AiyS7QXo'></iframe></div>
    <div><img src='data:image/gif;base64,AA' data-src='/inline.jpg?w=800&amp;h=450'></div>
    <p>The planet’s atmosphere is asymmetric — a new observation.</p>
    <video src='/clip.mp4?download=1'></video><p>${prose}</p>
  </div><div class='author-bio'><div><p>Author biography and contact details must not become article prose.</p></div></div></article>
  <script><p>Script content must not become article prose.</p></script></body></html>`;
const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item><title>Planet observation</title><link>https://publisher.example/planet</link><pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate>
    <description>${prose}</description><content:encoded><![CDATA[<p>${prose}</p><img data-src='/inline.jpg?w=800&amp;h=450'>]]></content:encoded></item>
  <item><title>New mission</title><link>https://publisher.example/mission</link><pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate><description>${prose}</description><media:thumbnail url='https://images.example/mission.jpg'/></item>
  <item><title>Another mission</title><link>https://publisher.example/another</link><pubDate>Fri, 23 Oct 2026 08:00:00</pubDate><description>${prose}</description><enclosure type='image/jpeg' url='https://images.example/another.jpg'/></item>
</channel></rss>`;
http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/article") {
    // No charset, as observed on Universe Today. The client must detect UTF-8.
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(article);
  }
  if (path === "/feed.xml") {
    res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
    return res.end(feed);
  }
  if (path === "/unavailable") {
    res.writeHead(503, { "Content-Type": "text/html" });
    return res.end("<html>Publisher temporarily unavailable</html>");
  }
  if (path === "/invalid-image.jpg") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<html>Publisher error page, not an image</html>");
  }
  if (path === "/image.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGPksoliYGBgYgADAAdaAKRzCbHKAAAAAElFTkSuQmCC", "base64"));
  }
  res.writeHead(501);
  res.end("Endpoint not modeled");
}).listen(process.env.PORT);
