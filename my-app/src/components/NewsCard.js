import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { pathFor } from "../lib/seo";
import LocalizedLink from "./primitives/LocalizedLink";
import "../styles/news.css";

export default function NewsCard({ item }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const category = item.category || "missions";
  const content = (
    <>
      {item.image ? (
        <img className="news-card-preview" src={item.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className={`news-card-preview news-card-preview-ph cat-${category}`} />
      )}
      <div className="news-card-body">
        <div className="top-row">
          <span className={`cat-pill ${category}`}>{t(`news.cat.${category}`, { defaultValue: category })}</span>
        </div>
        <h4>{item.title || "—"}</h4>
        <p>{item.excerpt}</p>
        <div className="bottom-row"><span>{item.source} · {item.date}</span></div>
      </div>
    </>
  );
  return item.id && item.slug ? (
    <LocalizedLink className="news-card" to={`${pathFor("news", lang)}/${item.slug}`}>{content}</LocalizedLink>
  ) : (
    <a className="news-card" href={item.url} target="_blank" rel="noopener noreferrer">{content}</a>
  );
}
