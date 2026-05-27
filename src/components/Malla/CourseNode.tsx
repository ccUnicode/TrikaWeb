import { Handle, Position } from '@xyflow/react';

interface CourseNodeProps {
  data: {
    name: string;
    code: string;
    evaluation_system: string;
  };
}

export default function CourseNode({ data }: CourseNodeProps) {
  return (
    <div className="w-[220px] rounded-xl border border-[#2A3240] bg-[#1E2430] flex flex-col overflow-hidden">
      <Handle type="target" position={Position.Left} />
      
      <div className="p-3 text-center">
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
