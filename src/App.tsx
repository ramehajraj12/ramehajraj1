import React, { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AppProvider, useApp, RequireRole } from "./lib/store";
import { runReminderCheck } from "./lib/services";
import { PublicLayout } from "./components/layout";
import { cls } from "./lib/utils";
import { ICheck, IWarn, IInfo, IX } from "./components/icons";

import Home from "./pages/Home";
import { Directory, ConsultantProfile as PublicConsultantProfile, BecomeConsultant, LegalPage } from "./pages/Public";
import Booking, { ManageBooking } from "./pages/Booking";
import AuthPage from "./pages/Auth";
import {
  ClientShell, ClientDashboard, ClientAppointments, ClientProjects, ClientProjectDetail,
  ClientFiles, ClientPayments, ClientInvoices, ClientProfile,
} from "./pages/ClientPortal";
import {
  ConsultantShell, ConsultantDashboard, ConsultantCalendar, ConsultantAppointments,
  ConsultantProjects, ConsultantProjectDetail, ConsultantClientsPage, ConsultantFiles,
  ConsultantAnalyses, ConsultantEarnings, ConsultantReviews, ConsultantAvailability, ConsultantProfile,
} from "./pages/ConsultantPortal";
import { AdminShell, AdminDashboard, AdminCalendar, AdminAppointments, AdminActivity, AdminSettings } from "./pages/AdminA";
import { AdminProjects, AdminProjectDetail, AdminClients, AdminConsultants, AdminServices, AdminApplications, AdminWaitlist } from "./pages/AdminB";
import { AdminPayments, AdminInvoices, AdminAnalytics, AdminReviews, AdminFiles } from "./pages/AdminC";

function ToastHost() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2.5 w-[min(92vw,380px)]">
      {toasts.map((t) => (
        <div key={t.id}
          className={cls("card !rounded-xl px-4 py-3.5 flex items-start gap-3 shadow-lift anim-slide-right",
            t.tone === "bad" && "!border-[#ecc9c9]", t.tone === "info" && "!border-primary-200")}>
          <span className={cls("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
            t.tone === "ok" ? "bg-ok-soft text-ok" : t.tone === "bad" ? "bg-bad-soft text-bad" : "bg-primary-50 text-primary-700")}>
            {t.tone === "ok" ? <ICheck size={15} /> : t.tone === "bad" ? <IWarn size={15} /> : <IInfo size={15} />}
          </span>
          <p className="text-[13.5px] font-semibold text-ink leading-snug flex-1">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} className="text-mute hover:text-ink transition-colors shrink-0"><IX size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Boot() {
  // idempotent reminder scheduler — runs once per load, dedupes per day
  useEffect(() => {
    const t = setTimeout(() => { void runReminderCheck().catch(() => undefined); }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function Public({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Boot />
        <Routes>
          {/* public */}
          <Route path="/" element={<Public><Home /></Public>} />
          <Route path="/konsulentet" element={<Public><Directory /></Public>} />
          <Route path="/konsulentet/:slug" element={<Public><PublicConsultantProfile /></Public>} />
          <Route path="/behu-konsulent" element={<Public><BecomeConsultant /></Public>} />
          <Route path="/privatesia" element={<Public><LegalPage kind="privacy" /></Public>} />
          <Route path="/kushtet" element={<Public><LegalPage kind="terms" /></Public>} />
          <Route path="/rezervo" element={<Public><Booking /></Public>} />
          <Route path="/menaxho/:token" element={<Public><ManageBooking /></Public>} />
          <Route path="/auth" element={<AuthPage />} />

          {/* client portal */}
          <Route path="/client" element={<RequireRole roles={["client"]}><ClientShell><ClientDashboard /></ClientShell></RequireRole>} />
          <Route path="/client/terminet" element={<RequireRole roles={["client"]}><ClientShell><ClientAppointments /></ClientShell></RequireRole>} />
          <Route path="/client/projektet" element={<RequireRole roles={["client"]}><ClientShell><ClientProjects /></ClientShell></RequireRole>} />
          <Route path="/client/projektet/:id" element={<RequireRole roles={["client"]}><ClientShell><ClientProjectDetailWrapper /></ClientShell></RequireRole>} />
          <Route path="/client/dokumentet" element={<RequireRole roles={["client"]}><ClientShell><ClientFiles /></ClientShell></RequireRole>} />
          <Route path="/client/pagesat" element={<RequireRole roles={["client"]}><ClientShell><ClientPayments /></ClientShell></RequireRole>} />
          <Route path="/client/faturat" element={<RequireRole roles={["client"]}><ClientShell><ClientInvoices /></ClientShell></RequireRole>} />
          <Route path="/client/profili" element={<RequireRole roles={["client"]}><ClientShell><ClientProfile /></ClientShell></RequireRole>} />

          {/* consultant portal */}
          <Route path="/consultant" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantDashboard /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/kalendari" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantCalendar /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/terminet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAppointments /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/projektet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProjects /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/projektet/:id" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProjectDetailWrapper /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/klientet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantClientsPage /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/dokumentet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantFiles /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/analizat" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAnalyses /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/te-ardhurat" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantEarnings /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/vleresimet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantReviews /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/disponueshmeria" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAvailability /></ConsultantShell></RequireRole>} />
          <Route path="/consultant/profili" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProfile /></ConsultantShell></RequireRole>} />

          {/* admin portal */}
          <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminShell><AdminDashboard /></AdminShell></RequireRole>} />
          <Route path="/admin/kalendari" element={<RequireRole roles={["admin"]}><AdminShell><AdminCalendar /></AdminShell></RequireRole>} />
          <Route path="/admin/terminet" element={<RequireRole roles={["admin"]}><AdminShell><AdminAppointments /></AdminShell></RequireRole>} />
          <Route path="/admin/projektet" element={<RequireRole roles={["admin"]}><AdminShell><AdminProjects /></AdminShell></RequireRole>} />
          <Route path="/admin/projektet/:id" element={<RequireRole roles={["admin"]}><AdminShell><AdminProjectDetailWrapper /></AdminShell></RequireRole>} />
          <Route path="/admin/klientet" element={<RequireRole roles={["admin"]}><AdminShell><AdminClients /></AdminShell></RequireRole>} />
          <Route path="/admin/konsulentet" element={<RequireRole roles={["admin"]}><AdminShell><AdminConsultants /></AdminShell></RequireRole>} />
          <Route path="/admin/aplikimet" element={<RequireRole roles={["admin"]}><AdminShell><AdminApplications /></AdminShell></RequireRole>} />
          <Route path="/admin/sherbimet" element={<RequireRole roles={["admin"]}><AdminShell><AdminServices /></AdminShell></RequireRole>} />
          <Route path="/admin/dokumentet" element={<RequireRole roles={["admin"]}><AdminShell><AdminFiles /></AdminShell></RequireRole>} />
          <Route path="/admin/pagesat" element={<RequireRole roles={["admin"]}><AdminShell><AdminPayments /></AdminShell></RequireRole>} />
          <Route path="/admin/faturat" element={<RequireRole roles={["admin"]}><AdminShell><AdminInvoices /></AdminShell></RequireRole>} />
          <Route path="/admin/analitika" element={<RequireRole roles={["admin"]}><AdminShell><AdminAnalytics /></AdminShell></RequireRole>} />
          <Route path="/admin/vleresimet" element={<RequireRole roles={["admin"]}><AdminShell><AdminReviews /></AdminShell></RequireRole>} />
          <Route path="/admin/lista-pritjes" element={<RequireRole roles={["admin"]}><AdminShell><AdminWaitlist /></AdminShell></RequireRole>} />
          <Route path="/admin/aktiviteti" element={<RequireRole roles={["admin"]}><AdminShell><AdminActivity /></AdminShell></RequireRole>} />
          <Route path="/admin/cilesimet" element={<RequireRole roles={["admin"]}><AdminShell><AdminSettings /></AdminShell></RequireRole>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </HashRouter>
    </AppProvider>
  );
}

function ClientProjectDetailWrapper() {
  const { id } = useParams();
  return <ClientProjectDetail id={id ?? ""} />;
}
function ConsultantProjectDetailWrapper() {
  const { id } = useParams();
  return <ConsultantProjectDetail id={id ?? ""} />;
}
function AdminProjectDetailWrapper() {
  const { id } = useParams();
  return <AdminProjectDetail id={id ?? ""} />;
}
