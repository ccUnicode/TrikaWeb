import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Link2, Loader2 } from 'lucide-react';

interface CourseData {
  id: number;
  code: string;
  name: string;
  credits?: number;
}

interface PlacedCourse extends CourseData {
  cycle: number;
  row_index: number;
  prerequisites?: number[];
}

interface CurriculumBuilderProps {
  planId: string;
  plan: {
    id: string;
    year: number;
    grid_rows: number;
    is_current: boolean;
    specialties?: {
      name: string;
    };
  };
  initialCourses: CourseData[];
  initialPlacedCourses: PlacedCourse[];
}

export default function CurriculumBuilder({ planId, plan, initialCourses, initialPlacedCourses = [] }: CurriculumBuilderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [placedCourses, setPlacedCourses] = useState<PlacedCourse[]>(initialPlacedCourses);
  const [draggedCourseId, setDraggedCourseId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedCourseForPrereqs, setSelectedCourseForPrereqs] = useState<PlacedCourse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveRoot, setSaveRoot] = useState<HTMLElement | null>(null);
  const [hasBeenSaved, setHasBeenSaved] = useState(initialPlacedCourses.length > 0);

  useEffect(() => {
    setSaveRoot(document.getElementById('react-save-button-root'));
  }, []);

  // Filtrar lista de cursos en el sidebar
  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return initialCourses;
    return initialCourses.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
    );
  }, [searchQuery, initialCourses]);

  const onDragStart = (event: React.DragEvent, course: CourseData) => {
    event.dataTransfer.setData('application/json', JSON.stringify(course));
    event.dataTransfer.effectAllowed = 'move';
    setDraggedCourseId(course.id);
  };

  const onDragEnd = () => {
    setDraggedCourseId(null);
  };

  const handleRemoveCourse = (courseId: number) => {
    setPlacedCourses(prev => prev.filter(p => p.id !== courseId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/save-malla', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planId,
          placedCourses: placedCourses.map(c => ({
            course_id: c.id,
            cycle: c.cycle,
            row_index: c.row_index,
            prerequisites: c.prerequisites || []
          }))
        })
      });

      const result = await response.json();
      if (result.ok) {
        setNotification({ message: '¡Malla guardada correctamente!', type: 'success' });
        setHasBeenSaved(true);
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({ message: 'Error al guardar la malla: ' + (result.error || 'Intente de nuevo.'), type: 'error' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      console.error("Error al guardar la malla:", err);
      setNotification({ message: 'Error de conexión al guardar la malla.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const saveButton = (
    <button
      onClick={handleSave}
      disabled={isSaving}
      className="bg-global-primary hover:bg-global-primary-hover text-black px-4 py-2 rounded-lg text-sm font-semibold shadow-md shadow-global-primary/10 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {isSaving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
      {isSaving ? "Guardando..." : (hasBeenSaved ? "Actualizar Malla" : "Guardar Malla")}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)] w-full">
      {saveRoot && createPortal(saveButton, saveRoot)}
      {/* Sidebar - Cursos disponibles */}
      <aside className="w-full lg:w-[350px] flex-shrink-0 flex flex-col h-full overflow-hidden bg-[#1e2430] border border-gray-800 rounded-xl p-4">
        <div className="border-b border-gray-800 pb-4 mb-4">
          <h2 className="text-base font-bold text-white mb-3 flex items-center justify-between relative">
            <span className="flex items-center gap-1.5">
              Cursos Disponibles
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="text-gray-500 hover:text-green-400 transition-colors focus:outline-none cursor-pointer"
                title="Información de la página"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </button>
              {showInfo && (
                <div className="absolute left-0 top-7 w-72 p-3.5 bg-global-card border border-global-border rounded-xl shadow-2xl z-50 text-xs text-gray-400 font-normal leading-relaxed">
                  <h4 className="font-semibold text-white mb-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ¿Cómo funciona?
                  </h4>
                  <p className="mb-2">
                    Constructor interactivo para estructurar la malla académica:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Organizar:</strong> Arrastra cursos a la cuadrícula para agregarlos o moverlos.</li>
                    <li><strong>Quitar:</strong> Pasa el cursor sobre un curso en la malla y haz clic en la <span className="text-red-400">"X"</span>.</li>
                    <li><strong>Prerrequisitos:</strong> Haz clic en un curso posicionado para gestionar sus requisitos.</li>
                    <li><strong>Buscar:</strong> Escribe en el buscador para filtrar asignaturas rápidamente.</li>
                  </ul>
                </div>
              )}
            </span>
            <span className="text-xs bg-green-500/10 text-green-400 px-2.5 py-0.5 rounded-full font-semibold border border-green-500/20">
              {filteredCourses.length}
            </span>
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-[#161b22] px-4 py-2 pl-9 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600/30 transition-all"
            />
            <svg
              className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>
        </div>

        {/* Lista de tarjetas arrastrables */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          {searchQuery.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-gray-500 text-xs">Escribe el nombre o código de un curso para buscar</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              No se encontraron cursos
            </div>
          ) : (
            filteredCourses.map((course) => {
              const isOnCanvas = placedCourses.some((n) => n.id === course.id);
              return (
                <div
                  key={course.id}
                  draggable={!isOnCanvas}
                  onDragStart={(e) => onDragStart(e, course)}
                  onDragEnd={onDragEnd}
                  className={`group relative p-3 rounded-xl border transition-all select-none flex items-start gap-2 ${isOnCanvas
                    ? 'bg-[#161b22]/50 border-gray-800/50 opacity-40 cursor-not-allowed'
                    : 'bg-[#1a202c] hover:bg-[#222938] border-gray-800 hover:border-indigo-500/50 cursor-grab active:cursor-grabbing hover:shadow-md hover:shadow-indigo-500/5'
                    }`}
                >
                  {!isOnCanvas && (
                    <div className="mt-1 text-gray-500 group-hover:text-indigo-400 transition-colors">
                      <GripVertical size={16} />
                    </div>
                  )}
                  {isOnCanvas && (
                    <div className="mt-1 w-4" /> // placeholder for alignment
                  )}

                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">
                        {course.code}
                      </span>
                      {course.credits !== undefined && (
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-800/50 px-1.5 py-0.5 rounded">
                          {course.credits} cr.
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-semibold text-white leading-tight group-hover:text-indigo-400 transition-colors">
                      {course.name}
                    </h3>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel de Estadísticas */}
        <div className="mt-auto border-t border-gray-800 pt-4 flex flex-col gap-1.5">
          <div className="bg-[#161b22] border border-gray-800 rounded-lg p-3 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Cursos en malla</span>
              <span className="text-sm font-bold text-white">{placedCourses.length}</span>
            </div>
            <div className="h-px w-full bg-gray-800"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Créditos Totales</span>
              <span className="text-sm font-bold text-[#22C55E]">{placedCourses.reduce((sum, n) => sum + (n.credits || 0), 0)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Canvas - Área de CSS Grid Nativo */}
      <main className="flex-1 h-full w-full bg-[#11151c] border border-global-border rounded-xl relative overflow-auto custom-scrollbar">
        <div className="w-[1100px] p-4 flex flex-col">
          {/* Cabeceras de Ciclos */}
          <div className="grid grid-cols-10 gap-1.5 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`header-${i + 1}`} className="text-center font-bold text-white bg-[#1e2430] border border-gray-800 rounded-lg p-2 shadow-sm text-xs">
                CICLO {i + 1}
              </div>
            ))}
          </div>

          {/* Cuadrícula Principal (Columnas y Slots) */}
          <div className="grid grid-cols-10 gap-1.5 flex-1">
            {Array.from({ length: 10 }).map((_, colIndex) => {
              const cycle = colIndex + 1;
              return (
                <div key={`col-${cycle}`} className="flex flex-col gap-1.5">
                  {Array.from({ length: plan.grid_rows }).map((_, rowIndex) => {
                    const row_index = rowIndex + 1;
                    const placedCourse = placedCourses.find(c => c.cycle === cycle && c.row_index === row_index);

                    return (
                      <Slot
                        key={`slot-${cycle}-${row_index}`}
                        cycle={cycle}
                        row_index={row_index}
                        placedCourse={placedCourse}
                        onDropCourse={(course) => {
                          setPlacedCourses(prev => {
                            const filtered = prev.filter(p => p.id !== course.id);
                            return [...filtered, { ...course, cycle, row_index }];
                          });
                        }}
                        onDragStartCourse={(e) => {
                          if (placedCourse) {
                            onDragStart(e, placedCourse);
                          }
                        }}
                        onDragEndCourse={onDragEnd}
                        draggedCourseId={draggedCourseId}
                        onRemoveCourse={handleRemoveCourse}
                        onClickCourse={(course) => setSelectedCourseForPrereqs(course)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Snackbar Notificación */}
      {notification && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl border z-50 flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-4 ${notification.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          )}
          <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      {/* Modal de Pre-requisitos */}
      {selectedCourseForPrereqs && (
        <PrereqsModal
          course={selectedCourseForPrereqs}
          placedCourses={placedCourses}
          onClose={() => setSelectedCourseForPrereqs(null)}
          onApply={(prereqIds) => {
            setPlacedCourses(prev => prev.map(c => 
              c.id === selectedCourseForPrereqs.id 
                ? { ...c, prerequisites: prereqIds } 
                : c
            ));
            setSelectedCourseForPrereqs(null);
            setNotification({ message: 'Pre-requisitos actualizados localmente.', type: 'success' });
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}
    </div>
  );
}

// Componente Slot Interno
function Slot({
  cycle,
  row_index,
  placedCourse,
  onDropCourse,
  onDragStartCourse,
  onDragEndCourse,
  draggedCourseId,
  onRemoveCourse,
  onClickCourse
}: {
  cycle: number;
  row_index: number;
  placedCourse?: PlacedCourse;
  onDropCourse: (course: CourseData) => void;
  onDragStartCourse: (e: React.DragEvent) => void;
  onDragEndCourse: () => void;
  draggedCourseId: number | null;
  onRemoveCourse: (id: number) => void;
  onClickCourse: (course: PlacedCourse) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permite el drop
    if (draggedCourseId !== placedCourse?.id) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedCourseId !== placedCourse?.id) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Si ya hay un curso en este slot y estamos intentando soltar algo distinto, evitamos sobrescribirlo (opcional)
    // Pero si es un movimiento válido, continuamos.
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const course = JSON.parse(data);
        onDropCourse(course);
      }
    } catch (err) {
      console.error('Error parsing drop data:', err);
    }
  };

  if (placedCourse) {
    const handleLocalDragStart = (e: React.DragEvent) => {
      const btn = e.currentTarget.querySelector('button');
      if (btn) {
        btn.style.display = 'none';
      }
      onDragStartCourse(e);
      setTimeout(() => {
        if (btn) {
          btn.style.display = '';
        }
      }, 0);
    };

    return (
      <div
        draggable
        onDragStart={handleLocalDragStart}
        onDragEnd={onDragEndCourse}
        onClick={() => onClickCourse(placedCourse)}
        title={placedCourse.name}
        className="h-10 w-full rounded-lg bg-[#2a3441] border border-indigo-500 shadow-sm flex items-center justify-center cursor-pointer hover:bg-[#323d4d] transition-colors group relative"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveCourse(placedCourse.id);
          }}
          className="absolute -top-1.5 -right-1.5 bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10 cursor-pointer"
          title="Remover curso de la malla"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        {placedCourse.prerequisites && placedCourse.prerequisites.length > 0 && (
          <div className="absolute bottom-1 left-1 bg-global-primary/20 border border-global-primary/30 text-global-primary rounded-full p-0.5 shadow-sm" title={`${placedCourse.prerequisites.length} pre-requisito(s)`}>
            <Link2 size={12} />
          </div>
        )}

        <span className="text-xs font-bold tracking-wider text-indigo-400 uppercase truncate px-2">
          {placedCourse.code}
        </span>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-10 w-full border border-dashed rounded-lg flex items-center justify-center transition-all duration-200 ${isDragOver
        ? 'border-green-500 bg-green-500/10'
        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
        }`}
    >
      {isDragOver && (
        <span className="text-xs font-bold text-green-500 tracking-wide uppercase pointer-events-none">Soltar aquí</span>
      )}
    </div>
  );
}

// PrereqsModal props
interface PrereqsModalProps {
  course: PlacedCourse;
  placedCourses: PlacedCourse[];
  onClose: () => void;
  onApply: (prereqIds: number[]) => void;
}

function PrereqsModal({ course, placedCourses, onClose, onApply }: PrereqsModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(course.prerequisites || []);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter by cycle and search query
  const availableCourses = placedCourses.filter(c => {
    if (c.cycle >= course.cycle) return false;
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.trim().toLowerCase();
    return c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query);
  });

  // Group by cycle
  const coursesByCycle = availableCourses.reduce((acc, c) => {
    if (!acc[c.cycle]) acc[c.cycle] = [];
    acc[c.cycle].push(c);
    return acc;
  }, {} as Record<number, PlacedCourse[]>);

  // Sort cycles
  const sortedCycles = Object.keys(coursesByCycle).map(Number).sort((a, b) => a - b);

  const togglePrereq = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#090b0f]/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#1e2430] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1a202c]">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Link2 className="text-global-primary" size={18} />
            Editar Pre-requisitos de:
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-5 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div className="mb-4 bg-[#161b22] border border-gray-800 p-3 rounded-xl flex items-center gap-2">
            <span className="font-mono text-global-primary font-bold">{course.code}</span>
            <span className="text-sm text-gray-300 font-medium">{course.name}</span>
          </div>
          
          <p className="text-xs text-gray-400 mb-4">
            Selecciona los cursos que deben aprobarse antes de llevar esta materia.
          </p>

          <div className="mb-4 relative">
            <input
              type="text"
              placeholder="Buscar curso por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-[#161b22] px-4 py-2 pl-9 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600/30 transition-all"
            />
            <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          
          {sortedCycles.length === 0 ? (
            <div className="text-center p-6 bg-gray-800/30 rounded-xl border border-gray-800/50">
              <p className="text-sm text-gray-500">No se encontraron cursos disponibles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCycles.map((cycle) => (
                <details key={cycle} open={searchQuery.trim().length > 0 ? true : undefined} className="group bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-gray-800/50 transition-colors">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      Ciclo {cycle}
                      <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                        {coursesByCycle[cycle].length} cursos
                      </span>
                    </span>
                    <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </summary>
                  <div className="p-3 border-t border-gray-800 space-y-2 bg-[#1a202c]">
                    {coursesByCycle[cycle].map(c => (
                      <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${selectedIds.includes(c.id) ? 'bg-green-500/10 border-green-500/50' : 'bg-[#161b22] border-gray-800 hover:border-gray-700'}`}>
                        <div className="flex-shrink-0 relative flex items-center justify-center w-5 h-5">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(c.id)}
                            onChange={() => togglePrereq(c.id)}
                            className="peer appearance-none w-5 h-5 border border-gray-600 rounded-md bg-[#1a202c] checked:bg-green-500 checked:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[#161b22] transition-all cursor-pointer"
                          />
                          {selectedIds.includes(c.id) && (
                            <svg className="w-3.5 h-3.5 text-white absolute pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-green-500 font-bold uppercase">{c.code}</span>
                          </div>
                          <p className="text-xs text-white font-medium mt-0.5">{c.name}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-800 bg-[#1a202c] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={() => onApply(selectedIds)} className="bg-global-primary hover:bg-global-primary-hover text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-global-primary/20 transition-all active:scale-95 cursor-pointer">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
