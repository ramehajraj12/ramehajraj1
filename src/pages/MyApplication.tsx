import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { getMyApplication, type ApplicationRow } from "../lib/services";
import { APPLICATION_STATUS, SPEC_LABEL, LANGUAGES } from "../lib/i18n";
import { fmtDate, fmtDateTime, cls } from "../lib/utils";
import { Badge, Button, Card, ErrorState, KV, Skeleton } from "../components/ui";
import { PublicLayout } from "../components/layout";
import { IGraduation, ICheck, IClock, IArrowR, IWarn, IX, IBriefcase } from "../components/icons";

const STATUS_ICON = {
  submitted: <IClock size={18} />,
  under_review: <IClock size={18} />,
  approved: <ICheck size={18} />,
  rejected: <IX size={18} />,
} as const;

const STATUS_TINT = {
  submitted: "bg-primary-50 text-primary-700 border-primary-200",
  under_review: "bg-warn-soft text-warn border-[#e5d3a3]",
  approved: "bg-ok-soft text-ok border-[#bfe3cf]",
  rejected: "bg-bad-soft text-bad border-[#ecc9c9]",
} as const;

function ApplicationBody() {
  const { session, user, reloadSession, toast } = useApp();
  const nav = useNavigate();
  const app = useAsync(async () => {
    try {
      return await getMyApplication(session);
    } catch (e) {
      console.error("Failed to load consultant application:", e);
      throw e;
    }
  }, [session?.user_id]);

  // If the application is approved but the cached role is stale, refresh the
  // profile once so the real Supabase role becomes the source of truth.
  const [refreshed, setRefreshed] = useState(false);
  useEffect(() => {
    if (app.data?.status === "approved" && user && user.role !== "consultant" && !refreshed) {
      setRefreshed(true);
      void reloadSession();
    }
  }, [app.data, user, refreshed, reloadSession]);

  if (app.loading) {
    return <div className="max-w-3xl mx-auto px-4 py-14"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-64 rounded-xl mt-4" /></div>;
  }
  if (app.error) {
    return <div className="max-w-3xl mx-auto px-4 py-14"><ErrorState message={app.error} onRetry={app.retry} /></div>;
  }

  const a: ApplicationRow | null = app.data ?? null;

  if (!a) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center mx-auto"><IGraduation size={24} /></span>
        <h1 className="font-display text-3xl font-bold text-ink mt-5">Aplikimi im për Konsulent</h1>
        <p className="text-mute mt-3 leading-relaxed">
          Nuk keni ende një aplikim për konsulent. Plotësoni aplikimin dhe ekipi do ta shqyrtojë para se të aktivizohet profili juaj i konsulentit.
        </p>
        <Link to="/behu-konsulent" className="inline-block mt-6">
          <Button size="lg">Plotësoni aplikimin <IArrowR size={15} /></Button>
        </Link>
      </div>
    );
  }

  const st = APPLICATION_STATUS[a.status] ?? APPLICATION_STATUS.submitted;
  const isConsultant = user?.role === "consultant";

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">StatLab · Konsulentët</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Aplikimi im për Konsulent</h1>
        <Badge tone={st.tone} className="!text-[13px] !px-3 !py-1.5">{st.label}</Badge>
      </div>

      {/* status banner */}
      <div className={cls("mt-6 rounded-xl border p-5 flex items-start gap-4 anim-fade-up", STATUS_TINT[a.status])}>
        <span className="w-10 h-10 rounded-xl bg-card/70 border border-line flex items-center justify-center shrink-0">{STATUS_ICON[a.status]}</span>
        <div className="flex-1">
          <p className="font-display font-bold text-ink text-[15px]">{st.label}</p>
          {a.status === "submitted" && (
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">Aplikimi juaj është dërguar me sukses. Do të njoftoheni pasi administratori ta shqyrtojë.</p>
          )}
          {a.status === "under_review" && (
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">Ekipi po e shqyrton aplikimin tuaj. Do të njoftoheni me email për vendimin.</p>
          )}
          {a.status === "approved" && !isConsultant && (
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed flex items-center gap-2">
              <IWarn size={14} /> Aplikimi u aprovua — duke rifreskuar sesionin për të aktivizuar rolin e konsulentit…
              <button onClick={() => { void reloadSession(); toast("Sesioni u rifreskua."); }} className="font-bold underline">Rifresko</button>
            </p>
          )}
          {a.status === "approved" && isConsultant && (
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">Urime! Keni akses të plotë në Portalin e Konsulentit dhe jeni të dukshëm në direktorinë publike.</p>
          )}
          {a.status === "rejected" && (
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">Aplikimi nuk u aprovua në këtë rund. Mund të aplikoni përsëri me më shumë detaje profesionale.</p>
          )}
        </div>
      </div>

      {/* portal access — gated ONLY by the real profile role */}
      {a.status === "approved" && isConsultant && (
        <div className="mt-5 anim-fade-up">
          <Button size="lg" className="w-full sm:w-auto" onClick={() => nav("/consultant")}>
            <IBriefcase size={16} /> Hap panelin e Konsulentit <IArrowR size={15} />
          </Button>
        </div>
      )}
      {a.status === "rejected" && (
        <div className="mt-5">
          <Link to="/behu-konsulent"><Button variant="outline">Aplikoni përsëri <IArrowR size={14} /></Button></Link>
        </div>
      )}

      {/* application detail */}
      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display font-bold text-ink">Detajet e aplikimit</p>
          <p className="font-mono text-[11.5px] text-mute">Dërguar më {fmtDateTime(a.created_at)}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8">
          <KV k="Emri" v={a.name} />
          <KV k="Email" v={a.email} />
          <KV k="Telefoni" v={a.phone || "—"} />
          <KV k="Shteti" v={a.country || "—"} />
          <KV k="Titulli profesional" v={a.professional_title || "—"} />
          <KV k="Edukimi" v={a.education || "—"} />
          <KV k="Vitet e përvojës" v={String(a.years_experience ?? 0)} />
          <KV k="LinkedIn" v={a.linkedin || "—"} />
        </div>
        {a.spss_experience && <KV k="Përvoja me SPSS" v={a.spss_experience} />}
        {a.methodology_experience && <KV k="Përvoja në metodologji" v={a.methodology_experience} />}
        {a.bio && <KV k="Biografia" v={a.bio} />}

        {(a.specializations ?? []).length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-2">Specializimet</p>
            <div className="flex flex-wrap gap-1.5">
              {a.specializations.map((s) => (
                <span key={s} className="text-[11.5px] font-semibold bg-primary-50 text-primary-800 rounded-md px-2 py-1">{SPEC_LABEL[s] ?? s}</span>
              ))}
            </div>
          </div>
        )}
        {(a.languages ?? []).length > 0 && (
          <div className="mt-3.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-2">Gjuhët</p>
            <div className="flex flex-wrap gap-1.5">
              {a.languages.map((l) => (
                <span key={l} className="text-[11.5px] font-semibold bg-paper border border-line rounded-md px-2 py-1">{LANGUAGES[l] ?? l}</span>
              ))}
            </div>
          </div>
        )}
        {a.motivation && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-2">Motivimi</p>
            <p className="text-[13.5px] text-ink-2 italic leading-relaxed">“{a.motivation}”</p>
          </div>
        )}
      </Card>

      <p className="text-[12px] text-mute mt-5 leading-relaxed">
        Referenca e aplikimit: <span className="font-mono">{a.id.slice(0, 8)}…</span> · Data: {fmtDate(a.created_at.slice(0, 10))}.
        Qasja në Portalin e Konsulentit aktivizohet vetëm pasi roli i profilit të ndryshohet nga administratori.
      </p>
    </div>
  );
}

export default function MyApplicationPage() {
  return (
    <PublicLayout>
      <ApplicationBody />
    </PublicLayout>
  );
}
