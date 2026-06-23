"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, CheckCircle2, Play, BookOpen, ExternalLink, Menu, X } from "lucide-react";

export default function CourseDashboard() {
  const { courseId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [userId, setUserId] = useState(null);
  
  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!courseId) return;

    const initCourse = async () => {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }
      setUserId(session.user.id);

      // Cargar info del curso
      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      setCourse(courseData);

      // Cargar módulos
      const { data: modulesData } = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      setModules(modulesData || []);

      if (modulesData && modulesData.length > 0) {
        const moduleIds = modulesData.map(m => m.id);

        // Cargar lecciones
        const { data: lessonsData } = await supabase
          .from("lessons")
          .select("*")
          .in("module_id", moduleIds)
          .order("order_index", { ascending: true });

        setLessons(lessonsData || []);

        // Cargar progreso del estudiante
        const { data: progressData } = await supabase
          .from("user_progress")
          .select("lesson_id")
          .eq("user_id", session.user.id);

        const progressSet = new Set(progressData?.map(p => p.lesson_id) || []);
        setCompletedLessons(progressSet);

        // Seleccionar lección por defecto: la primera incompleta, o la primera de todas
        if (lessonsData && lessonsData.length > 0) {
          const firstIncomplete = lessonsData.find(l => !progressSet.has(l.id));
          setSelectedLesson(firstIncomplete || lessonsData[0]);
        }
      }

      setLoading(false);
    };

    initCourse();
  }, [courseId, router]);

  const toggleLessonCompletion = async (lessonId) => {
    if (completedLessons.has(lessonId)) {
      // Marcar como incompleta (borrar de la BD)
      const { error } = await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", userId)
        .eq("lesson_id", lessonId);

      if (!error) {
        const updated = new Set(completedLessons);
        updated.delete(lessonId);
        setCompletedLessons(updated);
      }
    } else {
      // Marcar como completada (insertar en BD)
      const { error } = await supabase
        .from("user_progress")
        .insert({
          user_id: userId,
          lesson_id: lessonId
        });

      if (!error) {
        const updated = new Set(completedLessons);
        updated.add(lessonId);
        setCompletedLessons(updated);
      }
    }
  };

  // Calcular porcentaje de progreso
  const totalLessons = lessons.length;
  const completedCount = completedLessons.size;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem" }}>Abriendo el aula virtual...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2 style={{ marginBottom: "20px" }}>Curso no encontrado</h2>
        <button onClick={() => router.push("/courses")} className="btn btn-secondary">
          <ArrowLeft size={16} /> Volver a cursos
        </button>
      </div>
    );
  }

  // Agrupar lecciones por módulo
  const getModuleLessons = (moduleId) => {
    return lessons.filter(l => l.module_id === moduleId);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar de Lecciones */}
      <aside className="sidebar" style={{ display: sidebarOpen ? "flex" : "none" }}>
        <div className="sidebar-header" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button 
            onClick={() => router.push("/courses")} 
            style={{ 
              background: "transparent", 
              border: "none", 
              color: "var(--text-secondary)", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "8px", 
              cursor: "pointer",
              padding: "0"
            }}
          >
            <ArrowLeft size={16} /> Catálogo de cursos
          </button>
          
          <h2 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>{course.title}</h2>
          
          {/* Barra de progreso */}
          <div style={{ marginTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
              <span>Progreso del curso</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--primary)", transition: "width 0.4s ease" }}></div>
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          {modules.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px" }}>
              No hay lecciones agregadas a este curso.
            </p>
          ) : (
            modules.map((mod) => {
              const modLessons = getModuleLessons(mod.id);
              if (modLessons.length === 0) return null;
              return (
                <div key={mod.id} className="module-item">
                  <div className="module-header">{mod.title}</div>
                  <div>
                    {modLessons.map((les) => (
                      <button
                        key={les.id}
                        onClick={() => setSelectedLesson(les)}
                        className={`lesson-nav-btn ${selectedLesson?.id === les.id ? "active" : ""}`}
                      >
                        <span 
                          onClick={(e) => {
                            e.stopPropagation(); // Evita cambiar de lección solo por hacer click en el check
                            toggleLessonCompletion(les.id);
                          }}
                          style={{ display: "flex", alignItems: "center" }}
                        >
                          <CheckCircle2 
                            size={18} 
                            style={{ 
                              color: completedLessons.has(les.id) ? "var(--primary)" : "var(--text-muted)",
                              transition: "color 0.2s" 
                            }} 
                          />
                        </span>
                        <span style={{ flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {les.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Área Principal de Contenido */}
      <main className="main-content">
        {/* Toggle para Sidebar Móvil */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="btn btn-secondary" 
          style={{ 
            position: "absolute", 
            top: "20px", 
            left: "20px", 
            padding: "8px", 
            borderRadius: "50%",
            zIndex: 20
          }}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div style={{ maxWidth: "900px", margin: "0 auto", paddingTop: "20px" }}>
          {selectedLesson ? (
            <div>
              {/* Reproductor Vimeo */}
              <div className="video-container">
                <iframe
                  src={`https://player.vimeo.com/video/${selectedLesson.vimeo_id}?h=0&badge=0&autopause=0&player_id=0&app_id=58479`}
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                  title={selectedLesson.title}
                ></iframe>
              </div>

              {/* Encabezado e Interacción de Lección */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "30px" }}>
                <div>
                  <h1 style={{ fontSize: "1.8rem", marginBottom: "8px" }}>{selectedLesson.title}</h1>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                    {selectedLesson.description || "Esta lección no tiene una descripción asignada."}
                  </p>
                </div>
                
                <button 
                  onClick={() => toggleLessonCompletion(selectedLesson.id)}
                  className={`btn ${completedLessons.has(selectedLesson.id) ? "btn-secondary" : "btn-primary"}`}
                  style={{ flexShrink: 0 }}
                >
                  <CheckCircle2 size={18} />
                  {completedLessons.has(selectedLesson.id) ? "Lección Completada" : "Marcar como Completada"}
                </button>
              </div>

              {/* Pestañas de Recursos/Descargas */}
              <div>
                <div className="tabs">
                  <button className="tab-btn active">Recursos Adicionales</button>
                </div>

                <div className="glass-card" style={{ padding: "20px" }}>
                  {(!selectedLesson.resources || selectedLesson.resources.length === 0) ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                      Esta lección no tiene materiales descargables ni enlaces asignados.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {selectedLesson.resources.map((res, index) => (
                        <a 
                          key={index} 
                          href={res.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            backgroundColor: "rgba(255,255,255,0.02)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-primary)",
                            textDecoration: "none"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--primary-glow)";
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--border)";
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontWeight: "500" }}>
                            <BookOpen size={18} style={{ color: "var(--primary)" }} /> {res.name}
                          </span>
                          <ExternalLink size={16} style={{ color: "var(--text-muted)" }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ textAlign: "center", padding: "80px 40px" }}>
              <Play size={48} style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
              <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>Selecciona una lección</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Usa el panel de la izquierda para explorar los módulos y empezar a ver tus clases en video.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
