// On/off switch that submits a server action (the prototype's .ad-sw). Works without JavaScript.
export function SwitchButton({ on, action, label }: { on: boolean; action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`relative block h-[22px] w-[38px] cursor-pointer rounded-pill transition-colors after:absolute after:top-[3px] after:size-4 after:rounded-full after:bg-white after:transition-[left] after:content-[''] ${
          on ? "bg-success after:left-[19px]" : "bg-[#d1d5db] after:left-[3px]"
        }`}
      />
    </form>
  );
}
