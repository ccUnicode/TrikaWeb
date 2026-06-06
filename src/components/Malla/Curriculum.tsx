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
const COLUMN_WIDTH = 320;    // ancho
const ROW_HEIGHT = 160;      // alto

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
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
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

      // Nodos de cursos
      coursesInCycle.forEach((course) => {
        courseNodes.push({
          id: String(course.course_id),
          type: 'course',
          position: { 
            x: (course.cycle - 1) * COLUMN_WIDTH, 
            y: ((course.row_index || 1) - 1) * ROW_HEIGHT 
          },
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



  const toggleFullScreen = useCallback(() => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);

    setTimeout(() => {
      if (nextState) {
        fitView({ padding: 0.1, duration: 800 });
      } else {
        setViewport({ x: 100, y: 50, zoom: 0.85 }, { duration: 800 });
      }
    }, 150);
  }, [isFullscreen, fitView, setViewport]);

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

  return (
    <div className={
      isFullscreen 
        ? "fixed inset-0 z-[100] flex w-screen h-screen bg-global-bg p-4" 
        : "flex flex-col lg:flex-row gap-4 w-full h-[calc(100vh-260px)] mt-4"
    }>
      {/* Panel Lateral (Sidebar) */}
      {!isFullscreen && (
        <div className="w-full lg:w-[350px] xl:w-[400px] h-full bg-[#1e2430] border border-gray-800 rounded-xl p-6 flex flex-col">
          <div className="flex flex-col gap-4 h-full">
            <h2 className="text-white text-xl font-bold border-b border-gray-700 pb-2">Detalles del Curso</h2>
            <div className="flex flex-col gap-3 mt-2">
              <div className="h-6 bg-gray-800 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2 animate-pulse"></div>
            </div>
            <div className="h-32 bg-gray-800 rounded w-full mt-4 animate-pulse"></div>
            <p className="text-gray-500 text-sm mt-auto text-center">
              Haz clic en cualquier curso de la malla para ver su sumilla, profesores y pre-requisitos.
            </p>
          </div>
        </div>
      )}

      {/* Contenedor del Lienzo */}
      <div
        ref={containerRef}
        className="flex-1 h-full border border-global-border rounded-xl overflow-hidden relative bg-global-bg"
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
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240]"
          title="Acercar (Desbloquea vista)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>

        {/* Botón Zoom Out */}
        <button
          onClick={() => {
            zoomOut();
            setIsInteractable(true);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240]"
          title="Alejar (Desbloquea vista)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>

        {/* Botón Reset */}
        <button
          onClick={() => {
            setViewport({ x: 100, y: 50, zoom: 0.85 }, { duration: 800 });
            setIsInteractable(false);
          }}
          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
          title="Restaurar y Bloquear Vista"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          Reset
        </button>

        {/* Botón Fullscreen */}
        <button
          onClick={toggleFullScreen}
          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
          title="Pantalla Completa"
        >
          {isFullscreen ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg> Salir</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> Full</>
          )}
        </button>

      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        minZoom={0.2}
        maxZoom={1.2}
        translateExtent={[[-100, -100], [3300, 2600]]}
        defaultViewport={{ x: 100, y: 50, zoom: 0.85 }}
        panOnDrag={isInteractable}
        zoomOnScroll={false}
        zoomOnPinch={false}
        nodesDraggable={isDev ? isInteractable : false}
        nodesConnectable={false}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2A3240" gap={20} size={1} />
      </ReactFlow>
    </div>
    </div>
  );
}
