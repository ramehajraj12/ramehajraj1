import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sb, RECOVERY_MARKER } from "../lib/supabase";
import { setNewPassword } from "../lib/services";
import { homeForRole } from "../lib/store";
import type { Role } from "../types";
import { Button, Field, Skeleton, TextInput } from "../components/ui";
import { LogoMark, IShield, ICheck, IKey } from "../components/icons";

/**
 * Password recovery landing page. Supabase redirects the emailed link back to
 * the app with a recovery session; this page validates that session, lets the
 * user choose a new password, and confirms via auth.updateUser().
 */
export default function ResetPassword() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [doneRole, setDoneRole] = useState<Role | undefined>(undefined);

  // The recovery session can still be establishing when the page mounts
  // (PKCE code exchange is async), so probe briefly before declaring invalid.
  useEffect(() => {
    let alive = true;
    const probe = async (triesLeft: number) => {
      const { data } = await sb.auth.getSession();
      if (!alive) return;
      if (data.session?.user) { setValid(true); setChecking(false); return; }
      if (triesLeft > 0) setTimeout(() => probe(triesLeft - 1), 700);
      else setChecking(false);
    };
    probe(3);
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!pw) { setErr("Fjalëkalimi i ri është i detyrueshëm."); return; }
    if (pw.length < 8) { setErr("Fjalëkalimi duhet të ketë të paktën 8 karaktere."); return; }
    if (pw !== pw2) { setErr("Fjalëkalimet nuk përputhen."); return; }
    setBusy(true);
    try {
      const session = await setNewPassword(pw);
      sessionStorage.removeItem(RECOVERY_MARKER);
      setDoneRole(session.user.role);
      setDone(true);
    } catch (ex) {
      console.error("Password update failed:", ex);
      setErr(ex instanceof Error ? ex.message : "Ndryshimi i fjalëkalimit dështoi. Provoni përsëri.");
    } finally { setBusy(false); }
  };

  const finish = () => {
    sessionStorage.removeItem(RECOVERY_MARKER);
    nav(doneRole ? homeForRole(doneRole) : "/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-graph flex items-center justify-center p-6">
      <div className="w-full max-w-md anim-fade-up">
        <div className="flex justify-center mb-6"><Link to="/"><LogoMark size={38} /></Link></div>

        {checking ? (
          <div className="card p-8"><Skeleton className="h-24" /><Skeleton className="h-10 mt-4" /></div>
        ) : done ? (
          <div className="card p-8 text-center">
            <span className="w-12 h-12 rounded-xl bg-ok-soft text-ok flex items-center justify-center mx-auto"><ICheck size={22} /></span>
            <h2 className="font-display text-2xl font-bold text-ink mt-4">Fjalëkalimi u ndryshua</h2>
            <p className="text-mute text-sm mt-2 leading-relaxed">Fjalëkalimi i ri u ruajt me sukses. Tani mund të kyçeni në llogarinë tuaj.</p>
            <Button className="w-full mt-6" onClick={finish}>Vazhdo</Button>
          </div>
        ) : !valid ? (
          <div className="card p-8 text-center">
            <span className="w-12 h-12 rounded-xl bg-bad-soft text-bad flex items-center justify-center mx-auto"><IKey size={22} /></span>
            <h2 className="font-display text-2xl font-bold text-ink mt-4">Link i pavlefshëm ose i skaduar</h2>
            <p className="text-mute text-sm mt-2 leading-relaxed">
              Linku i rikuperimit nuk është më aktiv — mund të ketë skaduar ose të jetë përdorur tashmë. Kërkoni një link të ri nga faqja e kyçjes.
            </p>
            <Link to="/auth" className="block mt-6"><Button className="w-full">Kthehu te kyçja</Button></Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold text-ink">Vendos fjalëkalimin e ri</h2>
            <p className="text-mute text-sm mt-1.5">Zgjidhni një fjalëkalim të ri për llogarinë tuaj.</p>
            <form onSubmit={submit} className="card p-6 mt-5 space-y-4">
              <Field label="Fjalëkalimi i ri" required hint="Të paktën 8 karaktere.">
                <TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="Konfirmo fjalëkalimin" required>
                <TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>Ruaj fjalëkalimin e ri</Button>
              <p className="text-[11.5px] text-mute text-center flex items-center justify-center gap-1.5"><IShield size={12} /> Lidhja është e sigurt dhe verifikohet nga serveri.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
