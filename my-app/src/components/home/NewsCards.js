// Homepage "Останні новини" — the latest 6 articles from /api/news, same
// card markup/styles as the News page's cards view (news.css) so the two
// feeds look identical. Items with an id+slug link to the on-site article
// page; live-without-DB items link out to the source, same as News.js.
import { useApi } from "../../hooks/useApi";
import { useLang } from "../../context/LanguageContext";
import { getNews } from "../../lib/api";
import NewsCard from "../NewsCard";
import "../../styles/news.css";

const PAGE_SIZE = 6;

export default function NewsCards() {
  const { lang } = useLang();
  const { data, loading, error } = useApi(
    () => getNews(lang, { page: 0, pageSize: PAGE_SIZE }),
    { deps: [lang] }
  );
  const items = ((data && data.items) || []).slice(0, PAGE_SIZE);

  if (loading || error || items.length === 0) {
    return (
      <div className="news-list view-cards">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div className="news-card" key={i} aria-hidden="true">
            <div className="news-card-preview news-card-preview-ph" />
            <div className="news-card-body">
              <div className="top-row"><span className="cat-pill missions">—</span></div>
              <h4 style={{ color: "var(--text-dim)" }}>—</h4>
              <p style={{ color: "var(--text-dim)" }}>—</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="news-list view-cards">
      {items.map((item, i) => <NewsCard key={item.id || item.url || i} item={item} />)}
    </div>
  );
}
