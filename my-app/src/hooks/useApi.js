// useApi — fetch an /api endpoint, keep loading/error state, optionally poll,
// and refetch when `deps` change (e.g. the observer location). Replaces the
// fire-and-forget loaders in app.js with React-friendly state.
import { useEffect, useRef, useState, useCallback } from "react";

// `fetcher` is either a () => Promise<data> function, or a plain URL string.
// `deps` controls refetch. `interval` (ms) enables polling; 0 = off.
export function useApi(fetcher, { deps = [], interval = 0, initialData = null, revalidate = true } = {}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(initialData === null);
  const alive = useRef(true);
  const generation = useRef(0);

  const run = useCallback(async () => {
    const requestId = ++generation.current;
    try {
      const fn = typeof fetcher === "function" ? fetcher : () => fetch(fetcher).then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      const d = await fn();
      if (alive.current && requestId === generation.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current && requestId === generation.current) setError(e);
    } finally {
      if (alive.current && requestId === generation.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    // Invalidate requests even when this route is restored from server data.
    ++generation.current;
    setLoading(initialData === null);
    setError(null);
    if (initialData !== null) setData(initialData);
    if (initialData === null || revalidate) run();
    let id = null;
    if (interval > 0) id = setInterval(run, interval);
    return () => { alive.current = false; if (id) clearInterval(id); };
  }, [run, interval, initialData, revalidate]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return run();
  }, [run]);
  return { data, error, loading, refetch };
}
