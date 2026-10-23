"""NASA Science APOD payloads adapted to the bot/gallery's existing contract."""
from datetime import datetime, date
from html import unescape
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qs, urlencode
from zoneinfo import ZoneInfo

APOD_TZ = ZoneInfo('America/New_York')


def apod_today():
    return datetime.now(APOD_TZ).date()


class _Markup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.images = []
        self.videos = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        src = values.get('src') or ''
        if tag == 'img' and src:
            self.images.append(src)
        elif tag in ('iframe', 'video', 'source', 'embed') and src:
            self.videos.append(src)
        if tag in ('br', 'p', 'div'):
            self.text.append('\n')

    def handle_endtag(self, tag):
        if tag in ('p', 'div'):
            self.text.append('\n')

    def handle_data(self, data):
        self.text.append(data)


def plain_text(value):
    parser = _Markup()
    parser.feed(str(value or ''))
    return re.sub(r'\n{3,}', '\n\n', ''.join(parser.text)).strip()


def _http_url(value):
    value = unescape(str(value or '')).strip()
    if not value:
        return ''
    value = urljoin('https://science.nasa.gov/', value)
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme in ('https', 'http') and parsed.netloc else ''
    except ValueError:
        return ''


def _standard_image(url):
    parsed = urlsplit(url)
    if parsed.hostname != 'assets.science.nasa.gov' or not parsed.path.startswith('/dynamicimage/'):
        return url
    query = parse_qs(parsed.query)
    for dimension in ('w', 'h'):
        raw = query.get(dimension, ['1280'])[0]
        query[dimension] = [str(min(int(raw), 1280)) if raw.isdigit() and int(raw) > 0 else '1280']
    query['fit'] = ['clip']
    return urlunsplit(parsed._replace(query=urlencode(query, doseq=True)))


def normalize_apod(raw):
    if not isinstance(raw, dict):
        return None
    try:
        published = date.fromisoformat(raw.get('date') or '').isoformat()
    except (ValueError, TypeError):
        return None
    markup = _Markup()
    markup.feed(raw.get('basic_html') or '')
    media_type = str(raw.get('media_type') or 'image').lower()
    permalink = _http_url(raw.get('permalink'))
    hdurl = _http_url(raw.get('hdurl'))
    raw_url = _http_url(raw.get('url'))
    # The WordPress `url` identifies an HTML article, rather than its media.
    is_article = bool(permalink) or '/image-article/' in urlsplit(raw_url).path
    if media_type == 'video':
        url = next((src for item in markup.videos if (src := _http_url(item))), '')
        url = url or (_http_url(raw.get('video_url')) or ('' if is_article else raw_url))
        # A non-embeddable source page still provides a usable external link.
        url = url or permalink or raw_url
        thumbnail = _http_url(raw.get('thumbnail_url') or raw.get('thumbnail')) or hdurl
        hdurl = ''  # A video poster must never be treated as the video itself.
    else:
        hdurl = hdurl or next((src for item in markup.images if (src := _http_url(item))), '') or ('' if is_article else raw_url)
        url = _standard_image(hdurl) if is_article else raw_url or hdurl
        thumbnail = ''
    if not url and not hdurl:
        return None
    explanation = plain_text(raw.get('explanation'))
    explanation = re.sub(r'^Explanation:\s*', '', explanation, flags=re.I)
    explanation = re.split(r"\n+\s*Tomorrow[’']s picture\s*:", explanation, maxsplit=1, flags=re.I)[0].strip()
    return {'date': published, 'title': plain_text(raw.get('title')),
            'explanation': explanation, 'url': url, 'hdurl': hdurl,
            'media_type': media_type, 'thumbnail': thumbnail,
            'copyright': plain_text(raw.get('copyright') or raw.get('credit')),
            'permalink': permalink or raw_url if is_article else ''}
