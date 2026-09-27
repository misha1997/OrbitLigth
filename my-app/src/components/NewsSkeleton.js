import { useTranslation } from "react-i18next";
import "../styles/news.css";

export default function NewsSkeleton({ article = false, view = "cards" }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="news-loading">
      <p className="news-loading-label">{t(article ? "news.article.loading" : "news.loading")}</p>
      {article ? (
        <div aria-hidden="true">
          <div className="news-skeleton sk-title" />
          <div className="news-skeleton sk-line" />
          <div className="news-skeleton article-hero" />
          {Array.from({ length: 5 }, (_, i) => <div className="news-skeleton sk-line" key={i} />)}
        </div>
      ) : (
        <div className={`news-list view-${view}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="news-card" key={i}>
              <div className="news-card-preview news-skeleton" />
              <div className="news-card-body">
                <div className="news-skeleton sk-title" />
                <div className="news-skeleton sk-line" />
                <div className="news-skeleton sk-line" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
