import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { Mode, Snapshot } from "./lib";
import { readSnapshot, supabase } from "./lib";
import { Context } from "./context";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { DashboardSkeleton } from "./components/common";
const Shell = lazy(() => import("./components/Shell"));

export default function App() {
  const needsSnapshot = !["/", "/login"].includes(useLocation().pathname);
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("mode") === "replay" ? "replay" : "live";
  const eventId = params.get("event") || undefined;
  const setMode = (value: Mode) => {
    setSnap(null);
    setParams(value === "replay" ? { mode: "replay" } : {});
  };
  const selectReplay = (event: string) => {
    setSnap(null);
    setParams({ mode: "replay", event });
  };
  const [theme, updateTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("thermatwin-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  const setTheme = (value: "light" | "dark") => {
    updateTheme(value);
    try {
      localStorage.setItem("thermatwin-theme", value);
    } catch {
      /* The theme still works if storage is unavailable. */
    }
  };
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [toast, notify] = useState("");
  useEffect(() => {
    let alive = true;
    if (!needsSnapshot) {
      setSnap(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setSnap(null);
    readSnapshot(mode, eventId)
      .then((data) => {
        if (alive) setSnap(data);
      })
      .catch((e) => {
        if (alive) setError(String(e.message));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, eventId, revision, needsSnapshot]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true,
      changes = 0;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || changes) return;
        if (error) notify("Oturum yenilenemedi. Yeniden giriş yapın.");
        else setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        if (alive) {
          setAuthReady(true);
          notify("Oturum servisine erişilemiyor.");
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, value) => {
      changes++;
      setSession(value);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{
        mode,
        setMode,
        snap: snap?.mode === mode ? snap : null,
        loading,
        error,
        session,
        authReady,
        signOut: async () => {
          if (!supabase) return;
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            /* Local logout must also complete when the network is unavailable. */
          } finally {
            localStorage.removeItem("thermatwin-auth");
            setSession(null);
            notify("Bu tarayıcıdaki oturum kapatıldı.");
          }
        },
        refresh: () => setRevision((v) => v + 1),
        notify,
        theme,
        setTheme,
        selectReplay,
      }}
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<DashboardSkeleton />}>
              <Shell />
            </Suspense>
          }
        />
      </Routes>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Bildirimi kapat" onClick={() => notify("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
