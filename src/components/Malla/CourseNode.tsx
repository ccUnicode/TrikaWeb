import { Handle, Position } from '@xyflow/react';

interface CourseNodeProps {
  data: {
    name: string;
    code: string;
    evaluation_system: string;
    credits?: number;
    isSelected?: boolean;
  };
}

export default function CourseNode({ data }: CourseNodeProps) {
  const isSelected = data.isSelected === true;

  return (
    <div className={`w-[220px] h-[110px] rounded-xl border ${
      isSelected
        ? 'border-[#22c55e] shadow-lg shadow-[#22c55e]/20 ring-1 ring-[#22c55e]/30'
        : 'border-[#2A3240]'
    } bg-[#1E2430] flex flex-col overflow-hidden transition-all duration-200`}>
      <Handle type="target" position={Position.Left} />

      <div className="relative w-full flex-1 flex flex-col justify-center items-center">
        {data.credits !== undefined && (
          <span className="absolute top-2 right-2 text-[10px] font-medium text-gray-400">
            {data.credits} cr.
          </span>
        )}
        <span className="text-white text-sm font-semibold leading-tight text-center px-5 mt-2">
          {data.name}
        </span>
      </div>

      <div className="border-t border-[#2A3240] bg-black/20 flex justify-between items-center px-3 py-2">
        <span className="text-gray-400 text-xs">{data.code}</span>
        <span className="text-[#22c55e] text-xs font-medium bg-[#22c55e]/10 px-2 py-0.5 rounded-full">{data.evaluation_system}</span>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
