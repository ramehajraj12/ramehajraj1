import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./lib/app";
import AuthGate from "./pages/AuthGate";
import SettingsPage from "./pages/SettingsPage";
import { LogoMark, Spinner } from "./components/ui";
import { useI18n } from "./lib/i18n";

function Boot() {
  const { ready } = useApp();
  const { t } = useI18n();
  if (ready) return null;
  return (
    <div className="min-h-screen bg-paper bg-ambient flex flex-col items-center justify-center gap-4">
      <div className="bg-graph absolute inset-0" />
      <div className="relative flex items-center gap-3">
        <LogoMark size={38} />
        <span className="font-display font-bold text-2xl text-ink">Stat<span className="text-primary-600">Lab</span></span>
      </div>
      <span className="relative flex items-center gap-2 text-[13px] font-semibold text-mute">
        <Spinner size={15} className="text-primary-600" /> {t("common.loading")}
      </span>
    </div>
  );
}

function Gate() {
  const { profile, ready } = useApp();
  if (!ready) return <Boot />;
  return (
    <Routes>
      <Route path="/auth" element={profile ? <Navigate to="/settings" replace /> : <AuthGate />} />
      <Route path="/settings" element={profile ? <SettingsPage /> : <Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to={profile ? "/settings" : "/auth"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AppProvider>
  );
}
