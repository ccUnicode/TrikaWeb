interface CycleHeaderNodeProps {
  data: {
    label: string;
  };
}

export default function CycleHeaderNode({ data }: CycleHeaderNodeProps) {
  return (
    <div className="bg-[#1e2430] border-2 border-[#22c55e] rounded-lg px-6 py-3 w-[220px] text-center shadow-lg">
      <span className="text-[#22c55e] font-bold tracking-widest uppercase text-sm">
        {data.label}
      </span>
    </div>
  );
}
