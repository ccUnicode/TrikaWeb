import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CurriculumData } from '../../lib/curriculumTypes';
import CourseNode from './CourseNode';
import CycleHeaderNode from './CycleHeaderNode';

const nodeTypes = {
  course: CourseNode,
  cycleHeader: CycleHeaderNode,
};

// ─── Constantes de layout ───────────────────────────────────────────
const COLUMN_WIDTH = 275;    // ancho
const NODE_HEIGHT = 80;      // alto
const NODE_GAP_Y = 80;       // espacio vertical entre cursos del mismo ciclo
const HEADER_HEIGHT = 40;    // alto de la etiqueta de ciclo
const PADDING_TOP = 80;      // margen superior general
const PADDING_LEFT = 40;     // margen izquierdo

// ─── Estilos de nodo ────────────────────────────────────────────────

// ─── Componente principal ───────────────────────────────────────────
interface Props {
  data: CurriculumData;
}

export default function MallaCurricular(props: Props) {
  return (
    <ReactFlowProvider>
      <CurriculumInner {...props} />
    </ReactFlowProvider>
  );
}

function CurriculumInner({ data }: Props) {
  const isDev = import.meta.env.DEV;
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteractable, setIsInteractable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 1. Agrupar cursos por ciclo
  const coursesByCycle = useMemo(() => {
    const map = new Map<number, typeof data.courses>();
    for (const course of data.courses) {
      const list = map.get(course.cycle) || [];
      list.push(course);
      map.set(course.cycle, list);
    }
    return map;
  }, [data.courses]);

  // 2. Crear mapa de course_id → code para las aristas
  const courseIdToCode = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of data.courses) {
      map.set(c.course_id, c.code);
    }
    return map;
  }, [data.courses]);

  // 3. Generar nodos iniciales
  const initialNodes: Node[] = useMemo(() => {
    const TOTAL_CYCLES = 10;
    const headerNodes: Node[] = Array.from({ length: TOTAL_CYCLES }).map((_, i) => ({
      id: `cycle-header-${i + 1}`,
      type: 'cycleHeader',
      position: { x: i * COLUMN_WIDTH, y: 0 },
      data: { label: `CICLO ${i + 1}` },
      draggable: false,
      selectable: false,
    }));

    const courseNodes: Node[] = [];
    const sortedCycles = Array.from(coursesByCycle.keys()).sort((a, b) => a - b);

    for (const cycle of sortedCycles) {
      const coursesInCycle = [...(coursesByCycle.get(cycle) || [])].sort((a, b) => a.code.localeCompare(b.code));
      const x = (cycle - 1) * COLUMN_WIDTH;

      // Nodos de cursos
      coursesInCycle.forEach((course, idx) => {
        const y = PADDING_TOP + idx * (NODE_HEIGHT + NODE_GAP_Y);
        courseNodes.push({
          id: String(course.course_id),
          type: 'course',
          position: { x, y },
          data: {
            name: course.name,
            code: course.code,
            evaluation_system: course.evaluation_system,
            credits: course.credits,
            cycle: course.cycle,
          },
          draggable: isDev,
          connectable: false,
        });
      });
    }

    return [...headerNodes, ...courseNodes];
  }, [coursesByCycle, isDev]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const logPositions = () => {
    const positions = nodes
      .filter(n => n.type === 'course')
      .map(n => {
        const cycle = Number(n.data?.cycle) || 1;
        const perfectX = (cycle - 1) * COLUMN_WIDTH;
        return {
          code: n.data?.code,
          cycle: cycle,
          x: perfectX,
          y: Math.round(n.position.y)
        };
      });
    console.log(JSON.stringify(positions, null, 2));
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleFullScreen = () => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    } else {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    }
  };

  // ─── Generar aristas ────────────────────────────────────────────
  const edges: Edge[] = useMemo(() => {
    return data.prerequisites
      .filter(
        (pr) =>
          courseIdToCode.has(pr.course_id) &&
          courseIdToCode.has(pr.prerequisite_id)
      )
      .map((pr) => {
        const sourceId = String(pr.prerequisite_id);
        const targetId = String(pr.course_id);

        let edgeColor = '#4b5563';
        let strokeWidth = 1.5;
        let opacity = 0.4;
        let animated = false;

        if (hoveredNode !== null) {
          if (hoveredNode === sourceId || hoveredNode === targetId) {
            edgeColor = '#22c55e';
            strokeWidth = 3;
            opacity = 1;
            animated = true;
          } else {
            edgeColor = '#374151';
            strokeWidth = 1;
            opacity = 0.1;
            animated = false;
          }
        }

        const style = { stroke: edgeColor, strokeWidth, opacity };

        const isActive = hoveredNode !== null && (hoveredNode === sourceId || hoveredNode === targetId);

        return {
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          pathOptions: { borderRadius: 5 },
          animated,
          style,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: isActive ? 10 : 12,
            height: isActive ? 10 : 12,
            color: edgeColor,
          },
          zIndex: isActive ? 1000 : 0,
        };
      });
  }, [data.prerequisites, courseIdToCode, hoveredNode]);

  // ─── Click en nodo → navegar a detalle del curso ────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const code = node.data?.code as string | undefined;
    if (code) {
      window.location.href = `/curso/${code}`;
    }
  }, []);

  // ─── Calcular dimensiones del canvas ────────────────────────────
  const maxCoursesInCycle = Math.max(
    ...Array.from(coursesByCycle.values()).map((c) => c.length),
    1
  );
  const canvasHeight = Math.max(
    500,
    PADDING_TOP + maxCoursesInCycle * (NODE_HEIGHT + NODE_GAP_Y) + 40
  );

  return (
    <div
      ref={containerRef}
      className={`w-full border border-global-border rounded-xl overflow-hidden relative bg-[#0f1117] ${isFullscreen ? '!h-screen !rounded-none' : 'h-[calc(100vh-220px)]'}`}
    >
      {/* Panel de Controles Flotante */}
      <div className="absolute bottom-6 right-6 flex gap-2 z-50 bg-global-card/90 p-2 rounded-xl border border-global-border backdrop-blur-sm shadow-lg">
        {/* Indicador de Candado */}
        <div className="flex items-center gap-1.5 px-2 text-xs font-medium border-r border-global-border pr-3 mr-1 text-gray-400">
          <span className={`w-2 h-2 rounded-full ${isInteractable ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{isInteractable ? 'Interactivo' : 'Bloqueado'}</span>
        </div>

        {/* Botón Zoom In */}
        <button
          onClick={() => {
            zoomIn();
            setIsInteractable(true);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] font-bold text-base"
          title="Acercar (Desbloquea vista)"
        >
          +
        </button>

        {/* Botón Zoom Out */}
        <button
          onClick={() => {
            zoomOut();
            setIsInteractable(true);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] font-bold text-base"
          title="Alejar (Desbloquea vista)"
        >
          -
        </button>

        {/* Botón Reset */}
        <button
          onClick={() => {
            fitView({ duration: 500 });
            setIsInteractable(false);
          }}
          className="flex items-center justify-center px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
          title="Restaurar y Bloquear Vista"
        >
          Reset
        </button>

        {/* Botón Fullscreen */}
        <button
          onClick={handleFullScreen}
          className="flex items-center justify-center px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
          title="Pantalla Completa"
        >
          {isFullscreen ? 'Salir' : 'Full'}
        </button>

        {/* Botón Log Coordenadas */}
        {isDev && (
          <button
            onClick={logPositions}
            className="flex items-center justify-center px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
            title="Log Coordenadas en Consola"
          >
            💾 Log Coordenadas
          </button>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        panOnDrag={isInteractable}
        zoomOnScroll={false}
        zoomOnPinch={false}
        nodesDraggable={isDev ? isInteractable : false}
        nodesConnectable={false}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        minZoom={0.2}
        maxZoom={1.5}
        translateExtent={[[-200, -100], [3500, 2000]]}
        fitViewOptions={{ padding: 0.1 }}
        onInit={(reactFlowInstance) => reactFlowInstance.fitView({ duration: 800, padding: 0.1 })}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2A3240" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
