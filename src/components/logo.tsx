export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="15" className="fill-raised" />
        <rect x="17" y="16" width="30" height="4" rx="2" className="fill-accent" />
        <rect x="17" y="27" width="22" height="4" rx="2" className="fill-fg" />
        <rect x="17" y="38" width="30" height="4" rx="2" className="fill-fg opacity-55" />
        <rect x="17" y="49" width="14" height="4" rx="2" className="fill-fg opacity-30" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Briefly</span>
    </span>
  );
}
