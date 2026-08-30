import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp, homeForRole } from "../lib/store";
import { login, registerClient } from "../lib/services";
import { Button, Field, Segmented, TextInput } from "../components/ui";
import { LogoMark, IShield, ISpark, IKey } from "../components/icons";

const DEMO = [
  { label: "Admin", email: "admin@statlab.al", desc: "Menaxhon gjithë platformën" },
  { label: "Super Admin", email: "super@statlab.al", desc: "Akses i plotë" },
  { label: "Konsulent", email: "arben@statlab.al", desc: "Dr. Arben Hoxha" },
  { label: "Konsulent 2", email: "teuta@statlab.al", desc: "MSc. Teuta Morina" },
  { label: "Klient", email: "klient@demo.al", desc: "Portali i klientit" },
];

export default function AuthPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { toast } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const session = mode === "login"
        ? await login(email, password)
        : await registerClient({ full_name: name, email, phone, password });
      toast(mode === "login" ? `Mirë se erdhët, ${session.user.full_name}!` : "Llogaria u krijua me sukses!");
      nav(loc.state?.from ?? homeForRole(session.user.role), { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gabim gjatë identifikimit.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-graph grid lg:grid-cols-[0.9fr_1.1fr]">
      {/* left brand panel */}
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

      {/* right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md anim-fade-up">
          <div className="lg:hidden flex justify-center mb-6"><Link to="/"><LogoMark size={38} /></Link></div>
          <h2 className="font-display text-2xl font-bold text-ink">{mode === "login" ? "Kycuni në llogarinë tuaj" : "Krijoni llogari klienti"}</h2>
          <p className="text-mute text-sm mt-1.5">
            {mode === "login" ? "Qasuni në portalin tuaj sipas rolit." : "Regjistrohuni për të rezervuar dhe ndjekur projektet."}
          </p>

          <div className="mt-6">
            <Segmented
              options={[{ value: "login", label: "Kycu" }, { value: "register", label: "Regjistrohu" }]}
              value={mode} onChange={(m) => { setMode(m); setErr(""); }}
            />
          </div>

          <form onSubmit={submit} className="card p-6 mt-5 space-y-4">
            {mode === "register" && (
              <>
                <Field label="Emri i plotë" required><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Filan Fisteku" /></Field>
                <Field label="Telefoni"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+383…" /></Field>
              </>
            )}
            <Field label="Email" required><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ju@email.com" /></Field>
            <Field label="Fjalëkalimi" required hint={mode === "register" ? "Të paktën 8 karaktere." : undefined}>
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === "login" ? "Kycu" : "Krijo llogarinë"}
            </Button>
            {mode === "register" && (
              <p className="text-[11.5px] text-mute text-center">
                Duke u regjistruar pranoni <Link to="/privatesia" className="text-primary-600 underline">Politikën e Privatësisë</Link> dhe <Link to="/kushtet" className="text-primary-600 underline">Kushtet e Shërbimit</Link>.
              </p>
            )}
          </form>

          <div className="mt-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-mute mb-2.5 flex items-center gap-1.5"><IKey size={12} /> Llogari demo (fjalëkalimi: demo123)</p>
            <div className="grid grid-cols-1 gap-2">
              {DEMO.map((d) => (
                <button key={d.email} onClick={() => { setMode("login"); setEmail(d.email); setPassword("demo123"); setErr(""); }}
                  className="flex items-center justify-between card !rounded-lg px-3.5 py-2.5 hover:!border-primary-400 hover:shadow-soft transition-all text-left group">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-[11px] font-bold font-display">{d.label.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <p className="text-[13px] font-bold text-ink group-hover:text-primary-700 transition-colors">{d.label} <span className="text-mute font-normal font-mono text-[11px] ml-1">{d.email}</span></p>
                      <p className="text-[11px] text-mute">{d.desc}</p>
                    </div>
                  </div>
                  <ISpark size={14} className="text-mute group-hover:text-primary-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
