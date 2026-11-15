/** Custom switch: a button with role="switch". Space and Enter toggle it. On is the action colour everywhere. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors before:absolute before:-inset-2 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40 ${checked ? "border-action bg-action" : "border-line bg-track"}`}>
      <span aria-hidden className={`absolute top-0.5 size-[18px] rounded-full bg-card shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
