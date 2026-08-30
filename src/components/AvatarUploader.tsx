import React, { useRef, useState } from "react";
import { useApp } from "../lib/app";
import { useI18n } from "../lib/i18n";
import { AVATAR_EXTS, AVATAR_MAX_MB } from "../lib/supabase";
import { AccountError } from "../lib/account";
import { Avatar, Button, Modal, Spinner, ICameraIc, ITrashIc } from "./ui";

export function AvatarUploader() {
  const { profile, uploadAvatar, removeAvatar, toast, errText } = useApp();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!profile) return null;

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(AVATAR_EXTS as readonly string[]).includes(ext)) {
      toast(t("prof.photoErrType"), "bad");
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast(t("prof.photoErrSize"), "bad");
      return;
    }
    setBusy("upload");
    try {
      await uploadAvatar(file);
      toast(t("prof.photoOk"), "ok");
    } catch (e) {
      toast(e instanceof AccountError ? errText(e) : t("common.error"), "bad");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const doRemove = async () => {
    setConfirmOpen(false);
    setBusy("remove");
    try {
      await removeAvatar();
      toast(t("prof.photoRemoved"), "ok");
    } catch (e) {
      toast(e instanceof AccountError ? errText(e) : t("common.error"), "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        aria-label={t("prof.changePhoto")}
      />

      {/* avatar with hover veil + drop support */}
      <div
        className={
          "group/av relative rounded-full transition-transform duration-200 " +
          (dragOver ? "scale-105 ring-4 ring-primary-200" : "")
        }
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <Avatar name={profile.full_name || profile.email} url={profile.avatar_url} size={92} className="ring-1 ring-line" />
        {busy === "upload" ? (
          <span className="absolute inset-0 rounded-full bg-ink/55 flex items-center justify-center">
            <Spinner size={22} className="text-white" />
          </span>
        ) : (
          <button
            onClick={pick}
            aria-label={t("prof.changePhoto")}
            className="avatar-veil absolute inset-0 rounded-full bg-ink/55 flex flex-col items-center justify-center gap-1 text-white cursor-pointer"
          >
            <ICameraIc size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t("prof.changePhoto").split(" ")[0]}</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-ink">{t("prof.photo")}</p>
        <p className="text-[12.5px] text-mute mt-0.5">
          {t("prof.photoHint")} {busy === "upload" && <span className="text-primary-700 font-semibold">· {t("prof.uploading")}</span>}
        </p>
        <div className="flex flex-wrap gap-2.5 mt-3">
          <Button variant="outline" size="sm" onClick={pick} disabled={busy !== null} loading={busy === "upload"}>
            <ICameraIc size={14} /> {t("prof.changePhoto")}
          </Button>
          {profile.avatar_url && (
            <Button variant="ghost" size="sm" className="!text-bad hover:!bg-bad-soft" onClick={() => setConfirmOpen(true)} disabled={busy !== null}>
              <ITrashIc size={14} /> {busy === "remove" ? t("prof.removing") : t("prof.removePhoto")}
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("prof.removeTitle")}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>{t("prof.cancel")}</Button>
            <Button variant="danger" onClick={() => void doRemove()}>
              <ITrashIc size={14} /> {t("prof.remove")}
            </Button>
          </div>
        }
      >
        <p className="text-[13.5px] text-ink-2 leading-relaxed">{t("prof.removeBody")}</p>
      </Modal>
    </div>
  );
}
