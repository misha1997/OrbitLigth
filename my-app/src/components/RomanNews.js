import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getNews } from "../lib/api";
import { pathFor } from "../lib/seo";
import NewsCard from "./NewsCard";
import NewsSkeleton from "./NewsSkeleton";
import SectionHead from "./primitives/SectionHead";

const QUERY = "Roman";

export default function RomanNews() {
  const { t } = useTranslation();
  const { lang } = useLang();
  // The API searches both language versions across the entire archive,
  // before pagination, so older mission articles are included as well.
  const { data, loading, error, refetch } = useApi(
    () => getNews(lang, { page: 0, pageSize: 6, q: QUERY }),
    { deps: [lang] }
  );
  const items = data?.items || [];
  return (
    <section className="section" id="news" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead
          eyebrow={t("roman.news.eyebrow")}
          title={t("roman.news.title")}
          linkTo={`${pathFor("news", lang)}?q=${encodeURIComponent(QUERY)}`}
          linkLabel={t("roman.news.all")}
        />
        {loading ? <NewsSkeleton /> : error ? (
          <div className="news-feedback" role="alert">
            <h3>{t("news.loadError")}</h3>
            <p>{t("news.loadErrorSub")}</p>
            <button className="filter-pill" type="button" onClick={refetch}>{t("news.retry")}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="news-feedback" role="status"><p>{t("roman.news.empty")}</p></div>
        ) : (
          <div className="news-list view-cards">
            {items.map((item) => <NewsCard key={item.id || item.url} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
