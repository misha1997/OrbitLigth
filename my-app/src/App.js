// Bilingual path-prefix routing: /ua/... and /en/...
//
// Every page lives under a language prefix. A single /:lang/* route hands off
// to <LangRouter>, which maps the slug to the page by i18n name (translated
// slugs per language). The unprefixed "*" route is a client-side fallback for
// direct hits the server didn't already 301-redirect (legacy URLs are
// redirected server-side in web/app.py before the SPA loads). See lib/seo.js
// for the slug map (mirrors web/seo.py).
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { LocationProvider } from "./context/LocationContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { PickerProvider } from "./components/LocationPickerModal";
import Layout from "./components/layout/Layout";
import EmbedLayout from "./components/layout/EmbedLayout";
import LangRouter from "./components/LangRouter";
import NotFound from "./pages/NotFound";
import EmbedDarkSky from "./pages/EmbedDarkSky";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminNews from "./pages/admin/AdminNews";
import AdminNewsEditor from "./pages/admin/AdminNewsEditor";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPhotos from "./pages/admin/AdminPhotos";
import AdminPhotoEditor from "./pages/admin/AdminPhotoEditor";
import AdminGalaxies from "./pages/admin/AdminGalaxies";
import AdminGalaxyPhotos from "./pages/admin/AdminGalaxyPhotos";

// GA4 pageview on every SPA route change. The gtag() snippet in
// public/index.html fires the initial pageview; this sends the rest so
// client-side navigations (e.g. /ua/ -> /ua/mks) are tracked too.
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search + location.hash,
    });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <LanguageProvider>
        <AuthProvider>
          <LocationProvider>
            <PickerProvider>
              <Routes>
                <Route element={<EmbedLayout />}>
                  <Route path="/embed/dark-sky" element={<EmbedDarkSky />} />
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="news" element={<AdminNews />} />
                    <Route path="news/new" element={<AdminNewsEditor />} />
                    <Route path="news/:id" element={<AdminNewsEditor />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="photos" element={<AdminPhotos />} />
                    <Route path="photos/:date" element={<AdminPhotoEditor />} />
                    <Route path="galaxies" element={<AdminGalaxies />} />
                    <Route path="galaxies/:key" element={<AdminGalaxyPhotos />} />
                  </Route>
                </Route>
                <Route element={<Layout />}>
                  <Route path="/:lang/*" element={<LangRouter />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </PickerProvider>
          </LocationProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}