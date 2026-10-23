"""Normalize publisher HTML before the news parser extracts prose and media."""
import html
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit


def media_url(src: str, base_url: str = '') -> str:
    """Decode HTML attributes, resolve relative URLs, reject non-web media."""
    value = urljoin(base_url, html.unescape(src or '').strip())
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ('http', 'https') and parsed.netloc else ''
    except ValueError:
        return ''


class _NewsHTML(HTMLParser):
    _VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
    _DROP_TAGS = {'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form'}
    _DROP_CLASSES = {'author-bio', 'author-info', 'author-box', 'author-card', 'entry-tags', 'entry-meta', 'entry-footer'}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.parts = []
        self.skipped = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if self.skipped:
            if tag not in self._VOID:
                self.skipped.append(tag)
            return
        if tag in self._DROP_TAGS or self._DROP_CLASSES.intersection((values.get('class') or '').split()):
            if tag not in self._VOID:
                self.skipped.append(tag)
            return
        if tag in ('img', 'iframe', 'video', 'source'):
            src = (values.get('src') or '').strip()
            lazy = values.get('data-src') or values.get('data-lazy-src')
            if lazy and (not src or src.startswith(('data:', 'about:')) or re.search(r'(?:placeholder|blank|transparent|loading)\.(?:gif|png|svg)', src, re.I)):
                src = lazy
            if tag == 'img' and not src:
                srcset = values.get('data-srcset') or values.get('srcset') or ''
                candidates = re.findall(r'(?:^|,\s*)(\S+)\s+(\d+(?:\.\d+)?)[wx](?=\s*(?:,|$))', srcset)
                if candidates:
                    src = max(candidates, key=lambda item: float(item[1]))[0]
            if src:
                values['src'] = src
        encoded = ''.join(f' {name}="{html.escape(value, quote=True)}"' if value is not None else f' {name}' for name, value in values.items())
        self.parts.append(f'<{tag}{encoded}>')
        # Canonicalize direct <video src> into the same shape as <source>.
        if tag == 'video' and values.get('src'):
            self.parts.append(f'<source src="{html.escape(values["src"], quote=True)}">')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self._VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.skipped:
            if tag in self.skipped:
                index = len(self.skipped) - 1 - self.skipped[::-1].index(tag)
                del self.skipped[index:]
            return
        self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.skipped:
            self.parts.append(data)

    def handle_entityref(self, name):
        self.handle_data(f'&{name};')

    def handle_charref(self, name):
        self.handle_data(f'&#{name};')


def prepare_news_html(source: str) -> str:
    parser = _NewsHTML()
    parser.feed(source or '')
    parser.close()
    return ''.join(parser.parts)


def limit_body_media(body: str, images: list, videos: list, limit: int = 6000) -> tuple:
    """Do not leave partial placeholders or media rows beyond a truncated body."""
    if len(body) > limit:
        cut = limit
        for match in re.finditer(r'\[(?:IMG|VIDEO):\d+\]', body):
            if match.start() < cut < match.end():
                cut = match.start()
                break
        body = body[:cut].rstrip() + '...'
    kept_images = [int(pos) for pos in re.findall(r'\[IMG:(\d+)\]', body)]
    kept_videos = [int(pos) for pos in re.findall(r'\[VIDEO:(\d+)\]', body)]
    return (body, images[:max(kept_images) + 1] if kept_images else [],
            videos[:max(kept_videos) + 1] if kept_videos else [])
