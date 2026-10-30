import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BOT_URL, NAV_GROUPS } from "../../lib/constants";
import LocalizedLink from "../primitives/LocalizedLink";
import FeedbackModal from "../FeedbackModal";
import OnlineCounter from "./OnlineCounter";
import "../../styles/navigation.css";

export default function Footer() {
  const { t } = useTranslation();
  const [fbOpen, setFbOpen] = useState(false);
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <LocalizedLink to="home" className="logo">
              <img className="logo-img" src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
              <span>OrbitLight<small>{t("footer.tagline")}</small></span>
            </LocalizedLink>
            <p>{t("navigation.intro")}</p>
            <LocalizedLink to="home" className="footer-start">{t("nav.home")} <span aria-hidden="true">→</span></LocalizedLink>
          </div>
          <nav className="footer-navigation" aria-label={t("navigation.footer")}>
            {NAV_GROUPS.filter((group) => group.items).map((group) => <div className="footer-link-group" key={group.id}>
              <h2>{t(group.labelKey)}</h2>
              <ul>{group.items.map((item) => <li key={item.name}><LocalizedLink to={item.name}>{t(item.labelKey)}</LocalizedLink></li>)}</ul>
            </div>)}
          </nav>
        </div>
        <div className="footer-connect">
          <nav className="footer-project-links" aria-label={t("footer.colProject")}>
            <LocalizedLink to="news">{t("nav.news")}</LocalizedLink>
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer">{t("navigation.telegram")} <span aria-hidden="true">↗</span></a>
            <button type="button" onClick={() => setFbOpen(true)}>{t("footer.feedback")}</button>
          </nav>
          <OnlineCounter />
        </div>
        <div className="footer-bottom">
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.made")}</span>
        </div>
      </div>
      <FeedbackModal open={fbOpen} onClose={() => setFbOpen(false)} />
    </footer>
  );
}
