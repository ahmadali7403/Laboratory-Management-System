"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button, Field, Modal, inputClass } from "@/components/ui";

export default function PinOverrideModal({
  open,
  title = "Manager PIN Override Required",
  message = "This action exceeds your role limit. Ask a Manager or Admin to enter their 4–6 digit PIN.",
  onClose,
  onConfirm,
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    const clean = pin.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      setErr("Enter a valid 4 to 6 digit numeric PIN.");
      return;
    }
    setPin("");
    setErr("");
    onConfirm(clean);
  }

  return (
    <Modal
      open={open}
      onClose={() => { setPin(""); setErr(""); onClose?.(); }}
      size="sm"
      title={title}
      subtitle={message}
      footer={
        <>
          <Button variant="secondary" onClick={() => { setPin(""); setErr(""); onClose?.(); }}>
            Cancel (Esc)
          </Button>
          <Button type="submit" form="pin-override-form">
            Authorize &amp; Proceed
          </Button>
        </>
      }
    >
      <form id="pin-override-form" onSubmit={submit} className="space-y-3">
        <Field label="Manager / Admin Override PIN (4–6 digits)" required>
          <div className="relative">
            <KeyRound size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
              placeholder="••••"
              className={`${inputClass} pl-8 text-center font-mono text-base tracking-[0.4em]`}
            />
          </div>
        </Field>
        {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
      </form>
    </Modal>
  );
}
