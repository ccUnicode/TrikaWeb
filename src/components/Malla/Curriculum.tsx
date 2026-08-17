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
import { Info, X, ChevronDown } from 'lucide-react';

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
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showBanner, setShowBanner] = useState(true);

  const coursesByCycle = useMemo(() => {
    const map: Record<number, typeof data.courses> = {};
    for (const c of data.courses) {
      if (!map[c.cycle]) map[c.cycle] = [];
      map[c.cycle].push(c);
    }
    return map;
  }, [data.courses]);

  const sortedCycles = useMemo(() => {
    return Object.keys(coursesByCycle).map(Number).sort((a, b) => a - b);
  }, [coursesByCycle]);

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

  /**
   * Calcula el zoom mínimo necesario para que toda la malla curricular encaje 
   * horizontalmente en el contenedor actual y ajusta el viewport (cámara) 
   * a este nivel de zoom si es la primera vez que se renderiza o si el 
   * usuario ya estaba en el nivel de zoom mínimo.
   */
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

  // Crear mapa de course_id → code para las aristas
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

  /**
   * Calcula y genera la topología inicial de los nodos de la malla curricular.
   * 
   * Agrupa los cursos por ciclo para asignarlos a columnas específicas (eje X)
   * e itera sobre su índice de fila (eje Y) para calcular sus coordenadas exactas,
   * respetando el diseño de la cuadrícula. Genera automáticamente los nodos de 
   * encabezado estáticos para los 10 ciclos base.
   * 
   * @returns Un arreglo de nodos (`Node[]`) listos para ser renderizados por React Flow.
   */

  // Generar nodos iniciales
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

  /**
   * Restaura el zoom y la posición de la cámara del lienzo a su estado inicial, 
   * permitiendo al usuario volver a ver toda la malla curricular centrada.
   */
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

  /**
   * Construye las aristas (conexiones) basadas en los pre-requisitos de los cursos.
   * 
   * Implementa una lógica de retroalimentación visual dinámica: si el usuario 
   * pasa el cursor sobre un nodo (`hoveredNode`), el algoritmo resalta en verde 
   * las aristas conectadas directamente a él (entrantes y salientes) y opaca el 
   * resto del grafo para enfocar la ruta de aprendizaje.
   * 
   * @returns Un arreglo de aristas (`Edge[]`) con estilos y animaciones calculadas.
   */

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
  /**
   * Navega la cámara del lienzo hacia el nodo del curso o pre-requisito objetivo.
   * 
   * Utiliza la instancia de React Flow para buscar las coordenadas espaciales 
   * del nodo destino en el lienzo virtual y ejecuta una animación de paneo fluida 
   * (`setCenter`). Al instante, actualiza el estado local para reflejar los datos 
   * del nuevo curso en el panel lateral.
   * 
   * @param prerequisiteId - El identificador único (`course_id`) del curso a enfocar.
   */
  const handlePrerequisiteClick = useCallback((prerequisiteId: string) => {
    const node = getNode(prerequisiteId);
    if (node) {
      // Centrar en el nodo (mitad del ancho 220/2=110, mitad del alto 110/2=55)
      setCenter(node.position.x + 110, node.position.y + 55, { duration: 800, zoom: 1 });
    }
    setSelectedCourseId(prerequisiteId);
  }, [getNode, setCenter]);

  return (
    <>
      {/* VISTA MÓVIL (List Fallback) */}
      <div className="flex lg:hidden flex-col w-full h-full overflow-y-auto pb-20 mt-3 gap-3.5">
        {showBanner && (
          <div className="bg-[#141E2B] border border-[#233147] rounded-xl p-3.5 flex items-start gap-3 relative shadow-md">
            <Info className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-gray-300 pr-6 leading-relaxed">
              Para una experiencia visual completa explorando las rutas y pre-requisitos de forma interactiva, te recomendamos abrir esta malla desde una computadora.
            </p>
            <button 
              onClick={() => setShowBanner(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {sortedCycles.map((cycle) => (
            <details key={cycle} className="group bg-[#151C27] border border-[#222E40] rounded-2xl overflow-hidden shadow-sm transition-all duration-200 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none bg-[#1C2534] hover:bg-[#222E40] border-b border-transparent group-open:border-[#222E40] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                  <h3 className="font-bold text-white tracking-wide text-sm sm:text-base">CICLO {cycle}</h3>
                  <span className="bg-[#111722] border border-[#253245] px-2.5 py-0.5 rounded-full text-xs text-gray-400 font-medium">
                    {coursesByCycle[cycle].length} {coursesByCycle[cycle].length === 1 ? 'curso' : 'cursos'}
                  </span>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 group-open:text-[#22c55e] group-open:rotate-180 transition-transform duration-300" />
              </summary>
              <div className="p-3 sm:p-4 flex flex-col gap-2.5 bg-[#0F141E]/80">
                {coursesByCycle[cycle].map((course) => (
                  <button
                    key={course.course_id}
                    onClick={() => setSelectedCourseId(String(course.course_id))}
                    className="flex flex-col text-left gap-2 p-3.5 bg-[#17202D] hover:bg-[#1E293A] active:scale-[0.99] rounded-xl border border-[#232F42] hover:border-[#22c55e]/50 transition-all duration-200 shadow-sm group/card cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-mono text-xs font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/25 px-2 py-0.5 rounded-md tracking-wide">
                        {course.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {course.is_elective && (
                          <span className="text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-md">
                            Electivo
                          </span>
                        )}
                        {course.credits !== undefined && (
                          <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {course.credits} CR
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-gray-200 group-hover/card:text-white line-clamp-2 text-sm leading-snug">
                      {course.name}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* Modal Móvil (Bottom Sheet) */}
        {selectedCourseId && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e2430] w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden relative shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
              <div className="flex-shrink-0 p-4 border-b border-gray-800 flex justify-between items-center bg-[#2a3240]/30">
                <span className="font-bold text-white text-sm">Detalles del Curso</span>
                <button
                  onClick={() => setSelectedCourseId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedCourse ? (
                  <CourseDetailPanel
                    key={selectedCourse.course_id}
                    course={selectedCourse}
                    prerequisites={data.prerequisites}
                    allCourses={data.courses}
                    onPrerequisiteClick={(id) => {
                      setSelectedCourseId(id);
                      // Opcional: Podríamos scrollear al tope del modal aquí
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VISTA ESCRITORIO (React Flow) */}
      <div className={`hidden lg:flex ${
        isFullscreen
          ? "fixed inset-0 z-[100] w-screen h-screen bg-global-bg p-4"
          : "flex-col lg:flex-row gap-4 w-full h-[calc(100vh-240px)] mt-4"
      }`}>
      {/* Panel Lateral (Sidebar) */}
      {!isFullscreen && (
        <div className="w-full lg:w-[350px] xl:w-[400px] h-full bg-[#1e2430] border border-gray-800 rounded-xl flex flex-col overflow-hidden">
          {selectedCourse ? (
            <CourseDetailPanel
              key={selectedCourse.course_id}
              course={selectedCourse}
              prerequisites={data.prerequisites}
              allCourses={data.courses}
              onPrerequisiteClick={handlePrerequisiteClick}
            />
          ) : (
            <div className="flex flex-col gap-4 h-full p-6">
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
        {isControlsVisible ? (
          <div className="absolute bottom-6 right-6 flex gap-2 z-50 bg-global-card/90 p-2 rounded-xl border border-global-border backdrop-blur-sm shadow-lg transition-all">
            {/* Indicador de Estado */}
            <div className="flex items-center gap-1.5 px-2 text-xs font-medium border-r border-global-border pr-3 mr-1 text-gray-400">
              <span className={`w-2 h-2 rounded-full ${isZoomedIn ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
              <span>{isZoomedIn ? 'Libre' : 'Centrado'}</span>
            </div>

            {/* Botón Zoom In */}
            <button
              onClick={() => zoomIn()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] cursor-pointer"
              title="Acercar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>

            {/* Botón Zoom Out */}
            <button
              onClick={() => zoomOut()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] cursor-pointer"
              title="Alejar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>

            {/* Botón Reset */}
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold cursor-pointer"
              title="Restaurar y Centrar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              Reset
            </button>

            {/* Botón Fullscreen */}
            <button
              onClick={toggleFullScreen}
              className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] text-xs font-semibold cursor-pointer"
              title="Pantalla Completa"
            >
              {isFullscreen ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg> Salir</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> Full</>
              )}
            </button>

            {/* Botón Ocultar Controles */}
            <button
              onClick={() => setIsControlsVisible(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E2430] hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] transition-colors border border-[#2A3240] cursor-pointer"
              title="Ocultar controles"
              aria-label="Ocultar controles"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="3" y1="3" x2="21" y2="21" />
              </svg>
            </button>
          </div>
        ) : (
          /* Botón flotante compacto para volver a mostrar controles */
          <button
            onClick={() => setIsControlsVisible(true)}
            className="absolute bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-xl bg-global-card/90 hover:bg-[#2A3240] text-gray-400 hover:text-[#22c55e] border border-global-border backdrop-blur-sm shadow-lg transition-all cursor-pointer"
            title="Mostrar controles"
            aria-label="Mostrar controles"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}

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
    </>
  );
}
