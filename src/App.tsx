import React, { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppProvider, RequireRole, useApp, homeForRole } from "./lib/store";
import { AppProvider as AccountProvider } from "./lib/app";
import { captureRecoveryMarker, RECOVERY_MARKER } from "./lib/supabase";

import { PublicLayout } from "./components/layout";
import Home from "./pages/Home";
import { Directory, ConsultantProfile, BecomeConsultant, LegalPage } from "./pages/Public";
import Booking, { ManageBooking } from "./pages/Booking";
import AuthPage from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import MyApplicationPage from "./pages/MyApplication";
import SettingsPage from "./pages/SettingsPage";

import {
  ClientShell, ClientDashboard, ClientAppointments, ClientProjects, ClientProjectDetail,
  ClientFiles, ClientPayments, ClientInvoices, ClientProfile,
} from "./pages/ClientPortal";
import {
  ConsultantShell, ConsultantDashboard, ConsultantCalendar, ConsultantAppointments,
  ConsultantProjects, ConsultantProjectDetail, ConsultantClientsPage, ConsultantFiles,
  ConsultantAnalyses, ConsultantEarnings, ConsultantReviews, ConsultantAvailability,
  ConsultantProfile as ConsultantProfilePage,
} from "./pages/ConsultantPortal";
import { AdminShell, AdminDashboard, AdminCalendar, AdminAppointments, AdminActivity, AdminSettings } from "./pages/AdminA";
import {
  AdminProjects, AdminProjectDetail, AdminClients, AdminConsultants, AdminServices,
  AdminApplications, AdminWaitlist,
} from "./pages/AdminB";
import { AdminPayments, AdminInvoices, AdminAnalytics, AdminReviews, AdminFiles } from "./pages/AdminC";

function Public({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

/** Routes a user arriving via a password-recovery link to /reset-password. */
function RecoveryWatcher() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    captureRecoveryMarker();
    const t = setTimeout(() => {
      try {
        if (sessionStorage.getItem(RECOVERY_MARKER) && loc.pathname !== "/reset-password") {
          nav("/reset-password", { replace: true });
        }
      } catch { /* non-fatal */ }
    }, 250);
    return () => clearTimeout(t);
  }, [nav, loc.pathname]);
  return null;
}

/** Signed-in users skip the auth screen. */
function AuthRoute() {
  const { user } = useApp();
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return <AuthPage />;
}

function ClientProjectDetailRoute() {
  const { id } = useParams();
  return <ClientProjectDetail id={id ?? ""} />;
}
function ConsultantProjectDetailRoute() {
  const { id } = useParams();
  return <ConsultantProjectDetail id={id ?? ""} />;
}
function AdminProjectDetailRoute() {
  const { id } = useParams();
  return <AdminProjectDetail id={id ?? ""} />;
}


export default function App() {
  return (
    <AppProvider>
      <AccountProvider>
        <HashRouter>
          <RecoveryWatcher />
          <Routes>
            {/* ── public ── */}
            <Route path="/" element={<Public><Home /></Public>} />
            <Route path="/konsulentet" element={<Public><Directory /></Public>} />
            <Route path="/konsulentet/:slug" element={<Public><ConsultantProfile /></Public>} />
            <Route path="/behu-konsulent" element={<Public><BecomeConsultant /></Public>} />
            <Route path="/privatesia" element={<Public><LegalPage kind="privacy" /></Public>} />
            <Route path="/kushtet" element={<Public><LegalPage kind="terms" /></Public>} />
            <Route path="/rezervo" element={<Public><Booking /></Public>} />
            <Route path="/menaxho/:token" element={<Public><ManageBooking /></Public>} />
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ── applicant status (clients with an application + approved consultants) ── */}
            <Route path="/aplikimi-im" element={
              <RequireRole roles={["client", "consultant"]}>
                <Public><MyApplicationPage /></Public>
              </RequireRole>
            } />

            {/* ── account settings — every authenticated role, own data only ── */}
            <Route path="/settings" element={
              <RequireRole roles={["client", "consultant", "admin"]}>
                <SettingsPage />
              </RequireRole>
            } />

            {/* ── client portal ── */}
            <Route path="/client" element={<RequireRole roles={["client"]}><ClientShell><ClientDashboard /></ClientShell></RequireRole>} />
            <Route path="/client/terminet" element={<RequireRole roles={["client"]}><ClientShell><ClientAppointments /></ClientShell></RequireRole>} />
            <Route path="/client/projektet" element={<RequireRole roles={["client"]}><ClientShell><ClientProjects /></ClientShell></RequireRole>} />
            <Route path="/client/projektet/:id" element={<RequireRole roles={["client"]}><ClientShell><ClientProjectDetailRoute /></ClientShell></RequireRole>} />
            <Route path="/client/dokumentet" element={<RequireRole roles={["client"]}><ClientShell><ClientFiles /></ClientShell></RequireRole>} />
            <Route path="/client/pagesat" element={<RequireRole roles={["client"]}><ClientShell><ClientPayments /></ClientShell></RequireRole>} />
            <Route path="/client/faturat" element={<RequireRole roles={["client"]}><ClientShell><ClientInvoices /></ClientShell></RequireRole>} />
            <Route path="/client/profili" element={<RequireRole roles={["client"]}><ClientShell><ClientProfile /></ClientShell></RequireRole>} />

            {/* ── consultant portal ── */}
            <Route path="/consultant" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantDashboard /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/kalendari" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantCalendar /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/terminet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAppointments /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/projektet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProjects /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/projektet/:id" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProjectDetailRoute /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/klientet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantClientsPage /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/dokumentet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantFiles /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/analizat" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAnalyses /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/te-ardhurat" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantEarnings /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/vleresimet" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantReviews /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/disponueshmeria" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantAvailability /></ConsultantShell></RequireRole>} />
            <Route path="/consultant/profili" element={<RequireRole roles={["consultant"]}><ConsultantShell><ConsultantProfilePage /></ConsultantShell></RequireRole>} />

            {/* ── admin portal ── */}
            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminShell><AdminDashboard /></AdminShell></RequireRole>} />
            <Route path="/admin/kalendari" element={<RequireRole roles={["admin"]}><AdminShell><AdminCalendar /></AdminShell></RequireRole>} />
            <Route path="/admin/terminet" element={<RequireRole roles={["admin"]}><AdminShell><AdminAppointments /></AdminShell></RequireRole>} />
            <Route path="/admin/projektet" element={<RequireRole roles={["admin"]}><AdminShell><AdminProjects /></AdminShell></RequireRole>} />
            <Route path="/admin/projektet/:id" element={<RequireRole roles={["admin"]}><AdminShell><AdminProjectDetailRoute /></AdminShell></RequireRole>} />
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
        </HashRouter>
      </AccountProvider>
    </AppProvider>
  );
}
