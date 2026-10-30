"""Stored field guides: identical content for browsers and non-JS crawlers."""
from functools import lru_cache
import json
from pathlib import Path
import re

from fastapi.responses import HTMLResponse

_DATA = Path(__file__).resolve().parents[1] / "my-app" / "src" / "data"


@lru_cache(maxsize=4)
def _read(name):
    return json.loads((_DATA / f"{name}.json").read_text(encoding="utf-8"))


def guide_index():
    return _read("constellationGuideIndex")


def get_guide(slug):
    return next((item for item in guide_index()["items"] if item["slug"] == slug), None)


def guide_url(lang, slug):
    from web.seo import _loc
    return f"{_loc('constellations', lang)}/{slug}"


def constellation_response(index_html, lang, slug=None):
    from web.seo import render_html, prefix_for, slug_for_name
    base = f"/{prefix_for(lang)}/{slug_for_name('constellations', lang)}"
    item = get_guide(slug) if slug is not None else None
    if slug is not None and item is None:
        return HTMLResponse(render_html(index_html, "404", lang), status_code=404)
    overrides = None
    if item:
        content = _read("constellationGuidePages")[lang][slug]
        localized = item[lang]
        overrides = {
            "title": localized["title"], "desc": localized["description"],
            "image": localized["image"], "image_width": 1200, "image_height": 630,
            "canonical": guide_url(lang, slug),
            "uk_alt": guide_url("uk", slug), "en_alt": guide_url("en", slug),
            "breadcrumb_name": localized["name"], "modified": item.get("checked", guide_index()["checked"]),
        }
    else:
        content = _read("constellationLanding")[lang]
    result = render_html(index_html, "constellations", lang, overrides=overrides)
    result = result.replace("</head>", '<link rel="stylesheet" href="/constellations/guides.css"></head>', 1)
    result = result.replace('<div id="root"></div>', f'<div id="root">{content}</div>', 1)
    result = re.sub(r"<noscript>.*?</noscript>", "", result, flags=re.DOTALL)
    payload = json.dumps({"path": base + ("/" + slug if item else ""), "html": content}, ensure_ascii=False).replace("<", "\\u003c")
    result = result.replace("</body>", f'<script id="constellation-bootstrap" type="application/json">{payload}</script></body>', 1)
    return HTMLResponse(result, headers={"Cache-Control": "public, max-age=300"})
