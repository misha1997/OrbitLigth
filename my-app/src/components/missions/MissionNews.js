import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getNews } from "../../lib/api";
import { pathFor } from "../../lib/seo";
import NewsCard from "../NewsCard";
import NewsSkeleton from "../NewsSkeleton";
import SectionHead from "../primitives/SectionHead";
import "../../styles/news.css";

const QUERIES = { newhorizons: "New Horizons", juno: "Juno", chandra: "Chandra", tess: "TESS", europaclipper: "Europa Clipper" };
export default function MissionNews({ mission }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const ui = t("missionDetail.ui.news", { returnObjects: true });
  const query = QUERIES[mission];
  const { data, loading, error, refetch } = useApi(() => getNews(lang, { page: 0, pageSize: 6, q: query }), { deps: [lang, query] });
  return <section className="section" id="news"><div className="wrap">
    <SectionHead eyebrow={ui.eyebrow} title={`${ui.title} · ${query}`} linkTo={`${pathFor("news", lang)}?q=${encodeURIComponent(query)}`} linkLabel={ui.all} />
    {loading ? <NewsSkeleton /> : error ? <div className="news-feedback" role="alert"><p>{ui.error}</p><button type="button" className="btn ghost" onClick={refetch}>{ui.retry}</button></div> : !data?.items?.length ? <div className="news-feedback" role="status">{ui.empty}</div> : <div className="news-list view-cards">{data.items.map(item => <NewsCard key={item.id || item.url} item={item} />)}</div>}
  </div></section>;
}
