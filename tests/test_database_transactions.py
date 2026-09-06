"""Proves database/pool.py's autocommit=False actually gives ingest_news_articles
real all-or-nothing batch semantics, instead of the pre-fix behavior where each
INSERT committed itself immediately regardless of a later failure in the same
batch.

Uses a genuine constraint violation (an overlong `source` value against
`news_articles.source VARCHAR(120)`, which ingest_news_articles does not
truncate before inserting) rather than mocking, under this DB's confirmed
STRICT_TRANS_TABLES sql_mode — a realistic "malformed feed item" failure, not
an artificial test-only hook.
"""
import uuid

from database import get_db_connection, ingest_news_articles

_URL_PREFIX = "https://example.invalid/_test_txn_"


def _article(tag: str, source: str = "TestSource") -> dict:
    run_id = uuid.uuid4().hex[:8]
    return {
        "url": f"{_URL_PREFIX}{run_id}_{tag}",
        "title": f"Autocommit rollback test article {run_id} {tag}",
        "excerpt": "Integration test fixture — safe to delete.",
        "body": "",
        "image": "",
        "source": source,
        "category_bucket": "missions",
        "category": "Test",
        "date": "",
    }


def _cleanup():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM news_articles WHERE url LIKE %s", (f"{_URL_PREFIX}%",))
    conn.commit()
    cur.close()
    conn.close()


def _count_test_rows() -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM news_articles WHERE url LIKE %s", (f"{_URL_PREFIX}%",))
    n = cur.fetchone()[0]
    cur.close()
    conn.close()
    return n


def test_ingest_news_articles_rolls_back_whole_batch_on_mid_batch_error():
    """Article 1 is valid and would insert successfully on its own. Article 2
    has a `source` value longer than the column allows, which raises a real
    mysql.connector Error partway through the batch. Article 3 is valid too,
    but is never reached. Expected (post-fix): NONE of the three end up
    persisted — article 1's already-executed INSERT gets rolled back along
    with the rest, because nothing in the batch was committed yet."""
    _cleanup()
    try:
        good_1 = _article("good1")
        bad = _article("bad", source="X" * 200)  # VARCHAR(120) -> DataError
        good_2 = _article("good2")

        inserted = ingest_news_articles([good_1, bad, good_2])

        # The function is documented to "raise nothing on DB failure" — confirm
        # that contract still holds (the caller shouldn't need its own try/except).
        assert isinstance(inserted, int)

        # The real assertion: zero rows persisted, including good_1/good_2.
        assert _count_test_rows() == 0, (
            "Expected the whole batch to roll back on the mid-batch error, "
            "but found rows persisted from a batch that included a failure."
        )
    finally:
        _cleanup()


def test_ingest_news_articles_commits_when_batch_has_no_error():
    """Sanity check for the same code path with no failure: a clean batch
    should still commit and be visible from a fresh connection."""
    _cleanup()
    try:
        a1 = _article("clean1")
        a2 = _article("clean2")

        inserted = ingest_news_articles([a1, a2])

        assert inserted == 2
        assert _count_test_rows() == 2
    finally:
        _cleanup()
