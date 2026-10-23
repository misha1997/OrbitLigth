"""Read-only audit of the public archive and stored article bootstrap payloads.

Does not call /api/news/{slug}: that endpoint may fetch/translate and persist
articles. HTML pages expose stored data without triggering enrichment.
Reports candidates for review, never edits or deletes production records.
"""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import html
import io
import json
from pathlib import Path
import re
import threading
from urllib.parse import quote, urljoin

import requests

_local = threading.local()
BOOTSTRAP = re.compile(r'<script id="news-bootstrap"[^>]*>(.*?)</script>', re.S)
MEDIA = re.compile(r'\[(IMG|VIDEO):(\d+)\]')


def session():
    if not hasattr(_local, 'session'):
        _local.session = requests.Session()
        _local.session.headers['User-Agent'] = 'OrbitLight-news-audit/1.0'
    return _local.session


def article_issues(data):
    """Separate incomplete stored content from definite broken references."""
    issues = []
    body = data.get('body') or ''
    if not data.get('available'):
        issues.append('unavailable')
    if not body.strip():
        issues.append('empty_body')
    elif body == data.get('excerpt') and data.get('needs_enrichment'):
        issues.append('excerpt_only')
    elif len(MEDIA.sub('', body).strip()) < 200:
        issues.append('short_body')
    if re.search(r'APOD Astronomy Picture of the Day|Today.s APOD Archive Submissions|NASA Official|You have already liked this page', body, re.I):
        issues.append('site_chrome_in_body')
    if re.search(r'Andy has been interested in space exploration|About the Author|Follow us on', body, re.I):
        issues.append('author_or_promo_in_body')
    for kind, key in [('IMG', 'body_images'), ('VIDEO', 'body_videos')]:
        present = {str(item.get('position')) for item in data.get(key, []) if item.get('src')}
        expected = {pos for tag, pos in MEDIA.findall(body) if tag == kind}
        if expected - present:
            issues.append(f'missing_{kind.lower()}_references')
        if present - expected:
            issues.append(f'unused_{kind.lower()}_references')
    return issues


def read_article(base, item, lang):
    route = 'ua/novyny' if lang == 'uk' else 'en/news'
    url = f"{base}/{route}/{quote(item['slug'], safe='')}"
    row = {'slug': item['slug'], 'source': item.get('source'), 'lang': lang, 'url': url}
    try:
        response = session().get(url, timeout=20)
        row['status'] = response.status_code
        response.raise_for_status()
        match = BOOTSTRAP.search(response.text)
        if not match:
            raise ValueError('Missing news-bootstrap')
        data = json.loads(match[1]).get('data') or {}
        row.update(issues=article_issues(data), body_length=len(data.get('body') or ''),
                   needs_enrichment=bool(data.get('needs_enrichment')))
        row['media'] = [media['src'] for media in data.get('body_images', []) if media.get('src')]
    except (requests.RequestException, ValueError) as exc:
        row.update(issues=['article_request_failed'], error=str(exc))
    return row


def check_image(base, src):
    url = urljoin(base + '/', src)
    result = {'src': src, 'url': url}
    try:
        # Inspect a bounded prefix, not full-resolution multi-megabyte photos.
        with session().get(url, stream=True, timeout=15) as response:
            result['status'] = response.status_code
            result['content_type'] = response.headers.get('Content-Type', '')
            response.raise_for_status()
            prefix = response.raw.read(65536, decode_content=True)
            from PIL import Image
            try:
                with Image.open(io.BytesIO(prefix)) as image:
                    result['dimensions'] = list(image.size)
            except (OSError, ValueError):
                # Some WebP/JPEG headers cannot be read from a short prefix.
                # Retry with the complete file, under a strict size cap.
                remaining = response.raw.read(12 * 1024 * 1024, decode_content=True)
                with Image.open(io.BytesIO(prefix + remaining)) as image:
                    result['dimensions'] = list(image.size)
        result['ok'] = True
    except Exception as exc:
        result.update(ok=False, error=str(exc))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='https://orbitlight.space')
    parser.add_argument('--output', default='data/news-audit/report.json')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--limit', type=int, default=0, help='0 means the entire archive')
    parser.add_argument('--languages', nargs='+', choices=['en', 'uk'], default=['en', 'uk'])
    parser.add_argument('--check-images', action='store_true')
    parser.add_argument('--recheck-failures', action='store_true', help='Recheck only failed images/pages from an existing report')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')
    workers = max(1, min(args.workers, 6))
    if args.recheck_failures:
        output = Path(args.output)
        report = json.loads(output.read_text(encoding='utf-8'))
        failures = report['image_failures']
        with ThreadPoolExecutor(max_workers=workers) as pool:
            checked = list(pool.map(lambda item: dict(check_image(base, item['src']), slugs=item['slugs']), failures))
        report['image_failures'] = [item for item in checked if not item['ok']]
        for item in report['image_failures']:
            decoded = html.unescape(item['src'])
            if decoded != item['src']:
                item['after_entity_decode'] = check_image(base, decoded)
        cards = {item['slug']: item for item in report['cards']}
        for index, row in enumerate(report['articles']):
            if 'article_request_failed' in row['issues']:
                report['articles'][index] = read_article(base, cards[row['slug']], row['lang'])
        report['article_issue_counts'] = dict(Counter(issue for row in report['articles'] for issue in row['issues']))
        report['rechecked_at'] = datetime.now(timezone.utc).isoformat()
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'image_failures': report['image_failures'], 'article_issue_counts': report['article_issue_counts']}, ensure_ascii=True, indent=2))
        return
    first = session().get(f'{base}/api/news', params={'lang': 'en', 'page_size': 24}, timeout=20)
    first.raise_for_status()
    archive = first.json()
    items = archive['items']
    pages = archive['total_pages']
    with ThreadPoolExecutor(max_workers=workers) as pool:
        def read_page(page):
            response = session().get(f'{base}/api/news', params={'lang': 'en', 'page_size': 24, 'page': page}, timeout=20)
            response.raise_for_status()
            return response.json()['items']
        for batch in pool.map(read_page, range(1, pages)):
            items.extend(batch)
    items = list({item['slug']: item for item in items if item.get('slug')}.values())
    items.sort(key=lambda item: item.get('id') or 0, reverse=True)
    if args.limit:
        items = items[:args.limit]
    print(f"Archive: {archive['total']} records, auditing {len(items)} in {args.languages}", flush=True)
    rows = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(read_article, base, item, lang) for item in items for lang in args.languages]
        for future in as_completed(futures):
            rows.append(future.result())
            if len(rows) % 100 == 0:
                print(f'Articles: {len(rows)}/{len(futures)}', flush=True)
    references = defaultdict(set)
    for item in items:
        if item.get('image'):
            references[item['image']].add(item['slug'])
    for row in rows:
        for src in row.pop('media', []):
            references[src].add(row['slug'])
    images = []
    if args.check_images:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(check_image, base, src): src for src in references}
            for future in as_completed(futures):
                result = future.result()
                result['slugs'] = sorted(references[result['src']])
                images.append(result)
                if len(images) % 100 == 0:
                    print(f'Images: {len(images)}/{len(futures)}', flush=True)
    report = {
        'checked_at': datetime.now(timezone.utc).isoformat(), 'base_url': base,
        'archive_total': archive['total'], 'audited_articles': len(items), 'languages': args.languages,
        'source_counts': dict(Counter(item.get('source') for item in items)),
        'article_issue_counts': dict(Counter(issue for row in rows for issue in row['issues'])),
        'cards_without_image': [item['slug'] for item in items if not (item.get('image') or '').strip()],
        'escaped_image_urls': [{'src': src, 'decoded': html.unescape(src), 'slugs': sorted(slugs)}
                               for src, slugs in references.items() if html.unescape(src) != src],
        'image_checks': len(images), 'image_failures': [image for image in images if not image['ok']],
        'articles': sorted(rows, key=lambda row: (row['slug'], row['lang'])),
        'cards': items,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    summary = {key: value for key, value in report.items() if key not in ('articles', 'cards', 'image_failures', 'cards_without_image', 'escaped_image_urls')}
    summary.update(cards_without_image=len(report['cards_without_image']), escaped_image_urls=len(report['escaped_image_urls']), image_failures=len(report['image_failures']))
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print(f'Report: {output.resolve()}', flush=True)


if __name__ == '__main__':
    main()
