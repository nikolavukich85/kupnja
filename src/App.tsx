import { useMemo, useState } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./lib/ctx";
import { configured, createFamily, signIn, signOut, useFamily, useUser } from "./lib/db";
import { dueState } from "./lib/recurring";
import { ErrorNote } from "./components/ui";
import ListPage from "./pages/ListPage";
import StaplesPage from "./pages/StaplesPage";
import DealsPage from "./pages/DealsPage";
import CouponsPage, { couponState } from "./pages/CouponsPage";
import SettingsPage from "./pages/SettingsPage";

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="card w-full max-w-sm space-y-4 text-center">
        <img src="./icon-192.png" alt="" className="mx-auto h-16 w-16" />
        {children}
      </div>
    </div>
  );
}

function Login() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Center>
      <h1 className="h-title">Kupnja</h1>
      <p className="text-sm text-muted">Zajednički obiteljski popis, stalni artikli, akcije i kuponi.</p>
      <button
        className="btn-primary w-full py-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signIn();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Prijava Google računom
      </button>
      <ErrorNote error={error} />
    </Center>
  );
}

function FamilySetup({ email }: { email: string }) {
  const [name, setName] = useState("Naša obitelj");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Center>
      <h1 className="h-section">Dobro došli</h1>
      <p className="text-sm text-muted">
        Prijavljeni ste kao <b className="text-ink">{email}</b>. Ako vas je član obitelji već dodao, popis će se pojaviti sam. Inače napravite novi zajednički popis:
      </p>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="btn-primary w-full py-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await createFamily(email, name);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Napravi obiteljski popis
      </button>
      <ErrorNote error={error} />
      <button className="link text-sm" onClick={() => signOut()}>Prijava drugim računom</button>
    </Center>
  );
}

function Tab({ to, icon, label, badge }: { to: string; icon: string; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? "text-sea font-semibold" : "text-muted"}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
      {!!badge && (
        <span className="absolute top-1 left-1/2 ml-2 min-w-[18px] rounded-full bg-terra px-1 text-center text-[10px] leading-[18px] font-semibold text-paper">{badge}</span>
      )}
    </NavLink>
  );
}

function Shell() {
  const { items, staples, coupons } = useApp();
  const open = items?.filter((i) => !i.done).length ?? 0;
  const onList = useMemo(() => new Set(items?.filter((i) => !i.done && i.stapleId).map((i) => i.stapleId)), [items]);
  const due = staples?.filter((s) => !s.paused && !onList.has(s.id) && dueState(s.history, s.intervalDays).due).length ?? 0;
  const expiring = coupons?.filter((c) => !c.used && couponState(c).soon).length ?? 0;
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <main className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-28">
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/stalno" element={<StaplesPage />} />
          <Route path="/akcije" element={<DealsPage />} />
          <Route path="/kuponi" element={<CouponsPage />} />
          <Route path="/postavke" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          <Tab to="/" icon="🧺" label="Popis" badge={open} />
          <Tab to="/stalno" icon="🔁" label="Stalno" badge={due} />
          <Tab to="/akcije" icon="🏷️" label="Akcije" />
          <Tab to="/kuponi" icon="🎟️" label="Kuponi" badge={expiring} />
          <Tab to="/postavke" icon="⚙️" label="Postavke" />
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  const { user, ready } = useUser();
  const email = user?.email?.toLowerCase() ?? null;
  const { family, loading } = useFamily(email);

  if (!configured)
    return (
      <Center>
        <h1 className="h-section">Kupnja</h1>
        <p className="text-sm text-muted">Aplikacija još nije povezana s bazom (Firebase). Upiši postavke u src/firebase-config.ts.</p>
      </Center>
    );
  if (!ready || (user && loading)) return <Center><p className="text-muted">Učitavam…</p></Center>;
  if (!user || !email) return <Login />;
  if (!family) return <FamilySetup email={email} />;
  return (
    <AppProvider user={user} family={family}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}
