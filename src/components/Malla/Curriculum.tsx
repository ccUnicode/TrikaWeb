import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CurriculumData } from '../../lib/curriculumTypes';

// ─── Constantes de layout ───────────────────────────────────────────
const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const CYCLE_GAP_X = 260;    // espacio horizontal entre ciclos
const NODE_GAP_Y = 80;      // espacio vertical entre cursos del mismo ciclo
const HEADER_HEIGHT = 40;    // alto de la etiqueta de ciclo
const PADDING_TOP = 60;      // margen superior general
const PADDING_LEFT = 40;     // margen izquierdo

// ─── Estilos de nodo ────────────────────────────────────────────────
const courseNodeStyle: React.CSSProperties = {
  background: '#1E2430',
  border: '1px solid #2A3240',
  borderRadius: '12px',
  color: '#E6E9EF',
  fontSize: '11px',
  fontWeight: 500,
  padding: '8px 12px',
  width: NODE_WIDTH,
  cursor: 'pointer',
  textAlign: 'center' as const,
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const cycleHeaderStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#22c55e',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  width: NODE_WIDTH,
  textAlign: 'center' as const,
  pointerEvents: 'none' as const,
};

// ─── Componente principal ───────────────────────────────────────────
interface Props {
  data: CurriculumData;
}

export default function MallaCurricular({ data }: Props) {
  // Agrupar cursos por ciclo
  const coursesByCycle = useMemo(() => {
    const map = new Map<number, typeof data.courses>();
    for (const course of data.courses) {
      const list = map.get(course.cycle) || [];
      list.push(course);
      map.set(course.cycle, list);
    }
    return map;
  }, [data.courses]);

  // Crear mapa de course_id → code para las aristas
  const courseIdToCode = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of data.courses) {
      map.set(c.course_id, c.code);
    }
    return map;
  }, [data.courses]);

  // ─── Generar nodos ──────────────────────────────────────────────
  const nodes: Node[] = useMemo(() => {
    const result: Node[] = [];
    const sortedCycles = Array.from(coursesByCycle.keys()).sort((a, b) => a - b);

    for (const cycle of sortedCycles) {
      const coursesInCycle = coursesByCycle.get(cycle) || [];
      const x = PADDING_LEFT + (cycle - 1) * CYCLE_GAP_X;

      // Nodo cabecera del ciclo
      result.push({
        id: `cycle-header-${cycle}`,
        type: 'default',
        position: { x, y: PADDING_TOP - HEADER_HEIGHT - 10 },
        data: { label: `Ciclo ${cycle}` },
        draggable: false,
        connectable: false,
        selectable: false,
        style: cycleHeaderStyle,
      });

      // Nodos de cursos
      coursesInCycle.forEach((course, idx) => {
        const y = PADDING_TOP + idx * (NODE_HEIGHT + NODE_GAP_Y);
        result.push({
          id: String(course.course_id),
          type: 'default',
          position: { x, y },
          data: {
            label: `${course.code}\n${course.name}`,
            code: course.code,
          },
          draggable: false,
          connectable: false,
          style: courseNodeStyle,
        });
      });
    }

    return result;
  }, [coursesByCycle]);

  // ─── Generar aristas ────────────────────────────────────────────
  const edges: Edge[] = useMemo(() => {
    return data.prerequisites
      .filter(
        (pr) =>
          courseIdToCode.has(pr.course_id) &&
          courseIdToCode.has(pr.prerequisite_id)
      )
      .map((pr) => ({
        id: `e-${pr.prerequisite_id}-${pr.course_id}`,
        source: String(pr.prerequisite_id),
        target: String(pr.course_id),
        type: 'step',
        animated: true,
        style: { stroke: '#22c55e', strokeWidth: 2 },
      }));
  }, [data.prerequisites, courseIdToCode]);

  // ─── Click en nodo → navegar a detalle del curso ────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const code = node.data?.code as string | undefined;
    if (code) {
      window.location.href = `/curso/${code}`;
    }
  }, []);

  // ─── Calcular dimensiones del canvas ────────────────────────────
  const totalCycles = Math.max(...Array.from(coursesByCycle.keys()), 1);
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
      style={{
        width: '100%',
        height: `${canvasHeight}px`,
        backgroundColor: '#0f1117',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        colorMode="dark"
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={onNodeClick}
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2A3240" gap={20} size={1} />
        <Controls
          showInteractive={false}
          position="bottom-right"
        />
        <MiniMap
          nodeColor="#22c55e"
          maskColor="rgba(0,0,0,0.7)"
          style={{ backgroundColor: '#1a1a2e' }}
        />
      </ReactFlow>
    </div>
  );
}