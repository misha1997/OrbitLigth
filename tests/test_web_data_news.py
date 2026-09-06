"""Pins the behavior of web/data/news.py's `article_id: int = it["id"]` line
(_news_article_raw) — deliberately direct indexing instead of `.get("id")`,
so a row missing its primary key fails fast with KeyError instead of
silently continuing with article_id=None into downstream DB calls that
expect an int. This test exists so that assumption is verified, not just
argued in a commit message.
"""
from unittest.mock import patch

import pytest

from web.data.news import _news_article_raw


def test_news_article_raw_raises_keyerror_when_row_missing_id():
    fake_row = {"slug": "test-slug", "title": "Test", "url": "https://example.com/x", "body": "x"}
    assert "id" not in fake_row
    with patch("web.data.news.get_news_article_by_slug", return_value=fake_row):
        with pytest.raises(KeyError):
            _news_article_raw("test-slug", "en")


def test_news_article_raw_returns_unavailable_for_unknown_slug():
    with patch("web.data.news.get_news_article_by_slug", return_value=None):
        result = _news_article_raw("nonexistent-slug", "en")
    assert result == {"available": False}
