import { Handle, Position } from '@xyflow/react';

interface CourseNodeProps {
  data: {
    name: string;
    code: string;
    evaluation_system: string;
    credits?: number;
  };
}

export default function CourseNode({ data }: CourseNodeProps) {
  return (
    <div className="w-[220px] rounded-xl border border-[#2A3240] bg-[#1E2430] flex flex-col overflow-hidden">
      <Handle type="target" position={Position.Left} />

      <div className="relative py-3 px-6 w-full text-center flex items-center justify-center min-h-[48px]">
        {data.credits !== undefined && (
          <span className="absolute top-2 right-2 text-[10px] font-medium text-gray-400">
            {data.credits} cr.
          </span>
        )}
        <span className="text-white text-sm font-semibold">{data.name}</span>
      </div>

      <div className="border-t border-[#2A3240] bg-black/20 flex justify-between items-center px-3 py-2">
        <span className="text-gray-400 text-xs">{data.code}</span>
        <span className="text-[#22c55e] text-xs font-medium bg-[#22c55e]/10 px-2 py-0.5 rounded-full">{data.evaluation_system}</span>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
