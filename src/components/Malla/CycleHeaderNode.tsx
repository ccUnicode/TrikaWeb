interface CycleHeaderNodeProps {
  data: {
    label: string;
  };
}

export default function CycleHeaderNode({ data }: CycleHeaderNodeProps) {
  return (
    <div className="relative bg-[#1e2430] border border-[#22c55e]/40 rounded-xl px-6 py-3 w-[220px] text-center shadow-[0_0_20px_rgba(34,197,94,0.15)] overflow-hidden transition-all duration-300 hover:shadow-[0_0_25px_rgba(34,197,94,0.25)] hover:border-[#22c55e]/60">
      <div className="absolute inset-0 bg-gradient-to-b from-[#22c55e]/15 to-transparent pointer-events-none"></div>
      <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#22c55e] to-transparent opacity-80"></div>
      <span className="relative z-10 text-[#22c55e] font-extrabold tracking-[0.2em] uppercase text-sm drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
        {data.label}
      </span>
    </div>
  );
}
