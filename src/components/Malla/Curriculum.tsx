import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  useOnViewportChange,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CurriculumData } from '../../lib/curriculumTypes';
import CourseNode from './CourseNode';
import CycleHeaderNode from './CycleHeaderNode';
import CourseDetailPanel from './CourseDetailPanel';

const nodeTypes = {
  course: CourseNode,
  cycleHeader: CycleHeaderNode,
};

// ─── Constantes de layout ───────────────────────────────────────────
const COLUMN_WIDTH = 320;    // ancho
const ROW_HEIGHT = 160;      // alto

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
  const { zoomIn, zoomOut, getViewport, setViewport, getNode, setCenter } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [minZoom, setMinZoom] = useState(0.2);
  const [currentZoom, setCurrentZoom] = useState(0.85);
  const hasInitialized = useRef(false);

  const EXTENT_WIDTH = 3400; // Ancho total en coords de nodo: (10 col * 320) - 100 (última sin margen) = 3100 + padding
  const X_PADDING = 150;     // Padding fijo en unidades de nodo a los lados
  const Y_PADDING = 100;     // Padding superior e inferior en unidades de nodo

  const maxRowIndex = useMemo(() => {
    let max = 1;
    for (const c of data.courses) {
      if (c.row_index && c.row_index > max) {
        max = c.row_index;
      }
    }
    return max;
  }, [data.courses]);

  const maxY = useMemo(() => {
    // position Y de la última fila + alto del nodo (110) + padding inferior
    return maxRowIndex * ROW_HEIGHT + 110 + Y_PADDING;
  }, [maxRowIndex]);

  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth } = containerRef.current;

    const calculatedMinZoom = clientWidth / EXTENT_WIDTH;
    setMinZoom(calculatedMinZoom);

    const zoom = getViewport().zoom;
    // Si la vista está en el inicio o cerca de minZoom, forzar el encuadre
    if (!hasInitialized.current || zoom <= calculatedMinZoom + 0.02) {
      setViewport({
        x: X_PADDING * calculatedMinZoom,
        y: Y_PADDING * calculatedMinZoom,
        zoom: calculatedMinZoom
      });
      hasInitialized.current = true;
    }
  }, [getViewport, setViewport]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleResize();
    }, 50);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [handleResize]);

  useOnViewportChange({
    onChange: (viewport) => setCurrentZoom(viewport.zoom),
  });

  const isZoomedIn = currentZoom > minZoom + 0.02;

  // 2. Crear mapa de course_id → code para las aristas
  const courseIdToCode = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of data.courses) {
      map.set(c.course_id, c.code);
    }
    return map;
  }, [data.courses]);

  // Buscar el curso seleccionado
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return data.courses.find(c => String(c.course_id) === selectedCourseId) || null;
  }, [selectedCourseId, data.courses]);

  // 2. Generar nodos iniciales
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

    const courseNodes: Node[] = data.courses.map((course) => ({
      id: String(course.course_id),
      type: 'course',
      position: {
        x: (course.cycle - 1) * COLUMN_WIDTH,
        y: (course.row_index || 1) * ROW_HEIGHT
      },
      data: {
        name: course.name,
        code: course.code,
        evaluation_system: course.evaluation_system,
        credits: course.credits,
        cycle: course.cycle,
        isSelected: String(course.course_id) === selectedCourseId,
      },
      draggable: false,
      connectable: false,
    }));

    return [...headerNodes, ...courseNodes];
  }, [data.courses, selectedCourseId]);

  const handleReset = useCallback(() => {
    if (!containerRef.current) return;
    const calculatedMinZoom = containerRef.current.clientWidth / EXTENT_WIDTH;
    setViewport({ x: X_PADDING * calculatedMinZoom, y: Y_PADDING * calculatedMinZoom, zoom: calculatedMinZoom }, { duration: 800 });
  }, [setViewport]);

  const toggleFullScreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      handleResize();
    }, 150);
  }, [isFullscreen, handleResize]);

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

  // ─── Click en nodo → mostrar detalles en el panel ─────────────
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'cycleHeader') return;
    setSelectedCourseId(node.id);
  }, []);

  // ─── Navegación espacial de pre-requisitos ────────────────────
  const handlePrerequisiteClick = useCallback((prerequisiteId: string) => {
    const node = getNode(prerequisiteId);
    if (node) {
      // Centrar en el nodo (mitad del ancho 220/2=110, mitad del alto 110/2=55)
      setCenter(node.position.x + 110, node.position.y + 55, { duration: 800, zoom: 1 });
    }
    setSelectedCourseId(prerequisiteId);
  }, [getNode, setCenter]);

  return (
    <div className={
      isFullscreen
        ? "fixed inset-0 z-[100] flex w-screen h-screen bg-global-bg p-4"
        : "flex flex-col lg:flex-row gap-4 w-full h-[calc(100vh-240px)] mt-4"
    }>
      {/* Panel Lateral (Sidebar) */}
      {!isFullscreen && (
        <div className="w-full lg:w-[350px] xl:w-[400px] h-full bg-[#1e2430] border border-gray-800 rounded-xl p-6 flex flex-col">
          {selectedCourse ? (
            <CourseDetailPanel
              course={selectedCourse}
              prerequisites={data.prerequisites}
              allCourses={data.courses}
              onPrerequisiteClick={handlePrerequisiteClick}
            />
          ) : (
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
          )}
        </div>
      )}

      {/* Contenedor del Lienzo */}
      <div
        ref={containerRef}
        className="flex-1 h-full border border-global-border rounded-xl overflow-hidden relative bg-global-bg"
      >
        {/* Panel de Controles Flotante */}
        <div className="absolute bottom-6 right-6 flex gap-2 z-50 bg-global-card/90 p-2 rounded-xl border border-global-border backdrop-blur-sm shadow-lg">
          {/* Indicador de Estado */}
          <div className="flex items-center gap-1.5 px-2 text-xs font-medium border-r border-global-border pr-3 mr-1 text-gray-400">
            <span className={`w-2 h-2 rounded-full ${isZoomedIn ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
            <span>{isZoomedIn ? 'Libre' : 'Centrado'}</span>
          </div>

          {/* Botón Zoom In */}
          <button
            onClick={() => zoomIn()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240]"
            title="Acercar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>

          {/* Botón Zoom Out */}
          <button
            onClick={() => zoomOut()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240]"
            title="Alejar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>

          {/* Botón Reset */}
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold"
            title="Restaurar y Centrar"
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
          nodes={initialNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          minZoom={minZoom}
          maxZoom={1.2}
          translateExtent={[[-X_PADDING, -Y_PADDING], [EXTENT_WIDTH - X_PADDING, maxY]]}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          nodesDraggable={false}
          nodesConnectable={false}
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
