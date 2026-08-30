import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp, homeForRole } from "../lib/store";
import { login, registerClient, registerConsultantApplicant, getMyApplication } from "../lib/services";
import { Button, Field, Segmented, TextArea, TextInput } from "../components/ui";
import { LogoMark, IShield, IUser, IGraduation, IArrowR, IBriefcase } from "../components/icons";
import { SPECIALIZATION_OPTIONS, LANGUAGES } from "../lib/i18n";
import { cls } from "../lib/utils";

type Mode = "login" | "register";
type RegRole = "select" | "client" | "consultant";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email-i është i detyrueshëm.";
  if (!EMAIL_RE.test(email.trim())) return "Email-i nuk është i vlefshëm.";
  return null;
}
function validatePasswords(pw: string, confirm: string): string | null {
  if (!pw) return "Fjalëkalimi është i detyrueshëm.";
  if (pw.length < 8) return "Fjalëkalimi duhet të ketë të paktën 8 karaktere.";
  if (pw !== confirm) return "Fjalëkalimet nuk përputhen.";
  return null;
}

function ConsentRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-line-2 accent-[#1b44cc] cursor-pointer" />
      <span className="text-[12.5px] text-ink-2 leading-snug group-hover:text-ink transition-colors">{children}</span>
    </label>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cls("px-3 py-1.5 rounded-lg border text-[12.5px] font-semibold transition-all duration-150",
        active ? "bg-primary-600 border-primary-600 text-primary-50 shadow-soft" : "border-line-2 text-ink-2 hover:border-primary-300 hover:bg-primary-50/50")}>
      {label}
    </button>
  );
}

export default function AuthPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { session, toast } = useApp();

  const [mode, setMode] = useState<Mode>("login");
  const [regRole, setRegRole] = useState<RegRole>("select");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // client signup
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPw, setCPw] = useState("");
  const [cPw2, setCPw2] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cTerms, setCTerms] = useState(false);
  const [cPrivacy, setCPrivacy] = useState(false);

  // consultant signup — account
  const [aName, setAName] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aPw, setAPw] = useState("");
  const [aPw2, setAPw2] = useState("");
  const [aPhone, setAPhone] = useState("");
  // consultant signup — application
  const [aCountry, setACountry] = useState("");
  const [aTitle, setATitle] = useState("");
  const [aEducation, setAEducation] = useState("");
  const [aYears, setAYears] = useState("");
  const [aSpss, setASpss] = useState("");
  const [aMeth, setAMeth] = useState("");
  const [aBio, setABio] = useState("");
  const [aMotivation, setAMotivation] = useState("");
  const [aLinkedin, setALinkedin] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>(["sq"]);
  const [aTerms, setATerms] = useState(false);
  const [aPrivacy, setAPrivacy] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setRegRole("select"); setErr(""); setConfirmSent(false); };

  // ── LOGIN ───────────────────────────────────────────────────────────────────
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const em = validateEmail(email);
    if (em) { setErr(em); return; }
    if (!password) { setErr("Fjalëkalimi është i detyrueshëm."); return; }
    setBusy(true);
    try {
      const s = await login(email, password);
      toast(`Mirë se erdhët, ${s.user.full_name}!`);
      let dest = homeForRole(s.user.role);
      if (s.user.role === "client") {
        // applicants land on their application status page
        try {
          const app = await getMyApplication(s);
          if (app && app.status !== "approved") dest = "/aplikimi-im";
        } catch (ex) { console.error("Application lookup after login failed:", ex); }
      }
      nav(loc.state?.from ?? dest, { replace: true });
    } catch (ex) {
      console.error("Login failed:", ex);
      setErr(ex instanceof Error ? ex.message : "Gabim gjatë kyçjes. Provoni përsëri.");
    } finally { setBusy(false); }
  };

  // ── CLIENT SIGNUP ───────────────────────────────────────────────────────────
  const submitClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!cName.trim()) { setErr("Emri i plotë është i detyrueshëm."); return; }
    const em = validateEmail(cEmail);
    if (em) { setErr(em); return; }
    const pw = validatePasswords(cPw, cPw2);
    if (pw) { setErr(pw); return; }
    if (!cTerms || !cPrivacy) { setErr("Duhet të pranoni Kushtet e Shërbimit dhe Politikën e Privatësisë."); return; }
    setBusy(true);
    try {
      const s = await registerClient({ full_name: cName, email: cEmail, phone: cPhone, password: cPw });
      toast("Llogaria u krijua me sukses!");
      nav(loc.state?.from ?? homeForRole(s.user.role), { replace: true });
    } catch (ex) {
      console.error("Client registration failed:", ex);
      setErr(ex instanceof Error ? ex.message : "Regjistrimi dështoi. Provoni përsëri.");
    } finally { setBusy(false); }
  };

  // ── CONSULTANT SIGNUP ───────────────────────────────────────────────────────
  const submitConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!aName.trim()) { setErr("Emri i plotë është i detyrueshëm."); return; }
    const em = validateEmail(aEmail);
    if (em) { setErr(em); return; }
    const pw = validatePasswords(aPw, aPw2);
    if (pw) { setErr(pw); return; }
    if (!aPhone.trim()) { setErr("Telefoni është i detyrueshëm për konsulentët."); return; }
    if (!aTitle.trim()) { setErr("Titulli profesional është i detyrueshëm."); return; }
    if (!aEducation.trim()) { setErr("Edukimi është i detyrueshëm."); return; }
    if (specs.length === 0) { setErr("Zgjidhni të paktën një specializim."); return; }
    if (langs.length === 0) { setErr("Zgjidhni të paktën një gjuhë."); return; }
    if (!aMotivation.trim()) { setErr("Motivimi i shkurtër është i detyrueshëm."); return; }
    if (!aTerms || !aPrivacy) { setErr("Duhet të pranoni Kushtet e Shërbimit dhe Politikën e Privatësisë."); return; }

    setBusy(true);
    try {
      // No duplicate applications: if this identity already applied, go straight to the status page.
      if (session?.user) {
        try {
          const existing = await getMyApplication(session);
          if (existing) { nav("/aplikimi-im", { replace: true }); return; }
        } catch (ex) { console.error("Duplicate-application check failed:", ex); }
      }
      const res = await registerConsultantApplicant({
        name: aName, email: aEmail, password: aPw, phone: aPhone, country: aCountry,
        professional_title: aTitle, education: aEducation,
        years_experience: Number(aYears) || 0,
        spss_experience: aSpss, methodology_experience: aMeth,
        bio: aBio, motivation: aMotivation, linkedin: aLinkedin,
        specializations: specs, languages: langs, cv_file: "",
      });
      if (res.needsConfirmation) {
        setConfirmSent(true);
        toast("Llogaria u krijua — verifikoni email-in para se të kyçeni.");
        return;
      }
      toast("Aplikimi juaj u dërgua me sukses!");
      nav("/aplikimi-im", { replace: true });
    } catch (ex) {
      console.error("Consultant application failed:", ex);
      const msg = ex instanceof Error ? ex.message : "Dërgimi dështoi. Provoni përsëri.";
      setErr(msg.includes("verifikimit") ? msg : msg + " Nëse keni aplikuar më parë, kyçuni dhe hapni faqen e aplikimit.");
    } finally { setBusy(false); }
  };

  const forgotPassword = () => {
    toast("Rikuperimi i fjalëkalimit do të aktivizohet së shpejti. Kontaktoni suportin nëse keni nevojë.", "info");
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-graph grid lg:grid-cols-[0.9fr_1.1fr]">
      {/* brand panel */}
      <div className="bg-ink text-paper hidden lg:flex flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-graph-dark opacity-60" />
        <svg className="absolute -right-10 bottom-24 opacity-25" width="380" height="240" viewBox="0 0 380 240" fill="none">
          <path d="M10 220 C 80 60, 150 200, 210 120 S 330 30, 370 60" stroke="#8fabf7" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M10 200 C 90 130, 170 170, 240 120 S 340 80, 370 100" stroke="#c98d08" strokeWidth="2" strokeDasharray="4 7" />
        </svg>
        <Link to="/" className="relative flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="font-display font-bold text-xl">Stat<span className="text-primary-300">Lab</span></span>
        </Link>
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-300 mb-3">Portali i platformës</p>
          <h1 className="font-display text-4xl font-bold tracking-tight leading-tight">
            E gjithë platforma,<br />një hyrje e vetme.
          </h1>
          <p className="text-paper/60 mt-4 max-w-sm leading-relaxed">
            Klientët ndjekin projektet dhe skedarët e tyre, konsulentët menaxhojnë kalendarin dhe analizat, administratorët kanë pamje të plotë.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["RLS në çdo tabelë", "URL të nënshkruara", "Audit log"].map((x) => (
              <span key={x} className="text-[12px] font-semibold bg-paper/8 border border-paper/15 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><IShield size={12} className="text-primary-300" /> {x}</span>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-[11px] text-paper/40">SPSS Consulting Platform · v2.4</p>
      </div>

      {/* form column */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl anim-fade-up">
          <div className="lg:hidden flex justify-center mb-6"><Link to="/"><LogoMark size={38} /></Link></div>

          {confirmSent ? (
            <div className="card p-8 text-center">
              <span className="w-12 h-12 rounded-xl bg-ok-soft text-ok flex items-center justify-center mx-auto"><IShield size={22} /></span>
              <h2 className="font-display text-2xl font-bold text-ink mt-4">Verifikoni email-in</h2>
              <p className="text-mute text-sm mt-2 leading-relaxed">
                Llogaria u krijua. Hapni linkun e verifikimit në email dhe pastaj kyçuni — aplikimi juaj për konsulent do t'ju presë te faqja <b className="text-ink">Aplikimi im</b>.
              </p>
              <Button className="w-full mt-6" onClick={() => { setConfirmSent(false); switchMode("login"); }}>Kthehu te kyçja</Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-ink">
                {mode === "login" ? "Kyçu në StatLab" : "Krijoni llogarinë tuaj"}
              </h2>
              <p className="text-mute text-sm mt-1.5">
                {mode === "login"
                  ? "Qasuni në portalin tuaj sipas rolit."
                  : regRole === "select"
                    ? "Si dëshironi të regjistroheni?"
                    : regRole === "client"
                      ? "Rezervoni konsulenca dhe ndiqni projektet tuaja nga një portal i vetëm."
                      : "Aplikoni për t'u bërë konsulent — aplikimi shqyrtohet nga ekipi para aktivizimit."}
              </p>

              <div className="mt-6">
                <Segmented
                  options={[{ value: "login", label: "Kycu" }, { value: "register", label: "Regjistrohu" }]}
                  value={mode} onChange={(m) => switchMode(m as Mode)}
                />
              </div>

              {/* ── LOGIN ── */}
              {mode === "login" && (
                <form onSubmit={submitLogin} className="card p-6 mt-5 space-y-4">
                  <Field label="Email" required><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ju@email.com" autoComplete="email" /></Field>
                  <Field label="Fjalëkalimi" required>
                    <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  </Field>
                  {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
                  <Button type="submit" size="lg" className="w-full" loading={busy}>Kyçu</Button>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <button type="button" onClick={forgotPassword} className="font-semibold text-mute hover:text-primary-700 transition-colors">Keni harruar fjalëkalimin?</button>
                    <button type="button" onClick={() => switchMode("register")} className="font-bold text-primary-700 hover:text-primary-800 transition-colors">Nuk keni llogari? Regjistrohuni</button>
                  </div>
                </form>
              )}

              {/* ── ROLE SELECT ── */}
              {mode === "register" && regRole === "select" && (
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <button onClick={() => { setRegRole("client"); setErr(""); }}
                    className="card p-6 text-left hover:shadow-lift hover:-translate-y-1 hover:!border-primary-300 transition-all duration-200 group">
                    <span className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-primary-50 transition-colors"><IUser size={20} /></span>
                    <p className="font-display font-bold text-ink text-lg mt-4 group-hover:text-primary-700 transition-colors">Klient</p>
                    <p className="text-[13px] text-mute mt-1.5 leading-relaxed">Rezervoni konsulenca dhe menaxhoni projektet tuaja.</p>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary-700 mt-4"><IArrowR size={13} className="group-hover:translate-x-0.5 transition-transform" /> Vazhdo</span>
                  </button>
                  <button onClick={() => { setRegRole("consultant"); setErr(""); }}
                    className="card p-6 text-left hover:shadow-lift hover:-translate-y-1 hover:!border-primary-300 transition-all duration-200 group">
                    <span className="w-11 h-11 rounded-xl bg-teal-soft text-teal flex items-center justify-center group-hover:bg-teal group-hover:text-paper transition-colors"><IGraduation size={20} /></span>
                    <p className="font-display font-bold text-ink text-lg mt-4 group-hover:text-primary-700 transition-colors">Konsulent</p>
                    <p className="text-[13px] text-mute mt-1.5 leading-relaxed">Aplikoni për t'u bërë konsulent në StatLab.</p>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-teal mt-4"><IBriefcase size={13} /> Me shqyrtim nga ekipi</span>
                  </button>
                </div>
              )}

              {/* ── CLIENT SIGNUP ── */}
              {mode === "register" && regRole === "client" && (
                <form onSubmit={submitClient} className="card p-6 mt-5 space-y-4">
                  <button type="button" onClick={() => setRegRole("select")} className="text-[12.5px] font-bold text-mute hover:text-primary-700 transition-colors">← Zgjidhni llojin e llogarisë</button>
                  <Field label="Emri i plotë" required><TextInput value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Filan Fisteku" /></Field>
                  <Field label="Email" required><TextInput type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="ju@email.com" autoComplete="email" /></Field>
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <Field label="Fjalëkalimi" required hint="Të paktën 8 karaktere.">
                      <TextInput type="password" value={cPw} onChange={(e) => setCPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                    </Field>
                    <Field label="Konfirmoni fjalëkalimin" required>
                      <TextInput type="password" value={cPw2} onChange={(e) => setCPw2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                    </Field>
                  </div>
                  <Field label="Telefoni (opsional)"><TextInput value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+383…" /></Field>
                  <div className="space-y-2.5 pt-1">
                    <ConsentRow checked={cTerms} onChange={setCTerms}>
                      Pranoj <Link to="/kushtet" className="text-primary-600 font-bold underline">Kushtet e Shërbimit</Link>.
                    </ConsentRow>
                    <ConsentRow checked={cPrivacy} onChange={setCPrivacy}>
                      Pranoj <Link to="/privatesia" className="text-primary-600 font-bold underline">Politikën e Privatësisë</Link> dhe përpunimin e të dhënave të mia.
                    </ConsentRow>
                  </div>
                  {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
                  <Button type="submit" size="lg" className="w-full" loading={busy}>Krijo llogarinë</Button>
                </form>
              )}

              {/* ── CONSULTANT SIGNUP ── */}
              {mode === "register" && regRole === "consultant" && (
                <form onSubmit={submitConsultant} className="card p-6 mt-5 space-y-5">
                  <button type="button" onClick={() => setRegRole("select")} className="text-[12.5px] font-bold text-mute hover:text-primary-700 transition-colors">← Zgjidhni llojin e llogarisë</button>

                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary-600 mb-3">Llogaria</p>
                    <div className="space-y-4">
                      <Field label="Emri i plotë" required><TextInput value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Dr. Filan Fisteku" /></Field>
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Field label="Email" required><TextInput type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="ju@universitet.edu" autoComplete="email" /></Field>
                        <Field label="Telefoni" required><TextInput value={aPhone} onChange={(e) => setAPhone(e.target.value)} placeholder="+383…" /></Field>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Field label="Fjalëkalimi" required hint="Të paktën 8 karaktere.">
                          <TextInput type="password" value={aPw} onChange={(e) => setAPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                        </Field>
                        <Field label="Konfirmoni fjalëkalimin" required>
                          <TextInput type="password" value={aPw2} onChange={(e) => setAPw2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                        </Field>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary-600 mb-3">Profesional</p>
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Field label="Shteti"><TextInput value={aCountry} onChange={(e) => setACountry(e.target.value)} placeholder="Kosovë" /></Field>
                        <Field label="Titulli profesional" required><TextInput value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="p.sh. Statistikan i aplikuar" /></Field>
                      </div>
                      <Field label="Edukimi" required><TextInput value={aEducation} onChange={(e) => setAEducation(e.target.value)} placeholder="Master në Statistika të Aplikuara — Universiteti…" /></Field>
                      <Field label="Vitet e përvojës"><TextInput type="number" min={0} value={aYears} onChange={(e) => setAYears(e.target.value)} placeholder="0" /></Field>
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Field label="Përvoja me SPSS"><TextArea value={aSpss} onChange={(e) => setASpss(e.target.value)} placeholder="Vite, module, projekte…" /></Field>
                        <Field label="Përvoja në metodologji"><TextArea value={aMeth} onChange={(e) => setAMeth(e.target.value)} placeholder="Dizajne hulumtimi, mostra…" /></Field>
                      </div>
                      <Field label="Biografi e shkurtër"><TextArea value={aBio} onChange={(e) => setABio(e.target.value)} placeholder="Prezantim i shkurtër profesional…" /></Field>
                      <Field label="Specializimet" required>
                        <div className="flex flex-wrap gap-2">
                          {SPECIALIZATION_OPTIONS.map((o) => (
                            <Chip key={o.key} label={o.label} active={specs.includes(o.key)}
                              onClick={() => setSpecs(specs.includes(o.key) ? specs.filter((x) => x !== o.key) : [...specs, o.key])} />
                          ))}
                        </div>
                      </Field>
                      <Field label="Gjuhët" required>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(LANGUAGES).map(([k, v]) => (
                            <Chip key={k} label={v} active={langs.includes(k)}
                              onClick={() => setLangs(langs.includes(k) ? langs.filter((x) => x !== k) : [...langs, k])} />
                          ))}
                        </div>
                      </Field>
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Field label="LinkedIn (opsional)"><TextInput value={aLinkedin} onChange={(e) => setALinkedin(e.target.value)} placeholder="linkedin.com/in/…" /></Field>
                        <Field label="CV">
                          <div className="h-10 rounded-lg border border-dashed border-line-2 bg-paper/60 flex items-center px-3 text-[12px] text-mute">
                            Ngarkimi i skedarëve aktivizohet së shpejti
                          </div>
                        </Field>
                      </div>
                      <Field label="Motivimi i shkurtër" required><TextArea value={aMotivation} onChange={(e) => setAMotivation(e.target.value)} placeholder="Pse dëshironi të bashkoheni me StatLab?" /></Field>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <ConsentRow checked={aTerms} onChange={setATerms}>
                      Pranoj <Link to="/kushtet" className="text-primary-600 font-bold underline">Kushtet e Shërbimit</Link>.
                    </ConsentRow>
                    <ConsentRow checked={aPrivacy} onChange={setAPrivacy}>
                      Pranoj <Link to="/privatesia" className="text-primary-600 font-bold underline">Politikën e Privatësisë</Link> dhe përpunimin e të dhënave të mia.
                    </ConsentRow>
                  </div>

                  {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
                  <Button type="submit" size="lg" className="w-full" loading={busy}>Dërgo aplikimin</Button>
                  <p className="text-[11.5px] text-mute text-center leading-relaxed">
                    Aplikimi shqyrtohet nga ekipi. Pas aprovimit fitoni akses në Portalin e Konsulentit dhe bëheni të dukshëm në direktorinë publike.
                  </p>
                </form>
              )}

              {mode === "register" && regRole !== "select" && (
                <p className="text-[11.5px] text-mute text-center mt-4">
                  Keni tashmë llogari?{" "}
                  <button onClick={() => switchMode("login")} className="font-bold text-primary-700 hover:text-primary-800 transition-colors">Kyçuni</button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
