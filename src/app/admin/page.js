"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, Trash2, BookOpen, Video, Layers, FolderPlus, LogOut } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Datos cargados de la DB
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);

  // Selecciones
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);

  // Inputs para Cursos
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Inputs para Módulos
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // Inputs para Lecciones
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDesc, setNewLessonDesc] = useState("");
  const [newLessonVimeoId, setNewLessonVimeoId] = useState("");
  
  // Recursos temporales para la nueva lección
  const [newLessonResources, setNewLessonResources] = useState([]);
  const [resName, setResName] = useState("");
  const [resUrl, setResUrl] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      // Verificar rol en perfiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData?.role !== "admin") {
        router.push("/courses"); // Estudiantes no entran
        return;
      }
      setProfile(profileData);

      // Cargar Cursos
      await loadCourses();
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const loadCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    setCourses(data || []);
  };

  const loadModules = async (courseId) => {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    setModules(data || []);
    setLessons([]); // Reset lecciones
    setSelectedModule(null);
  };

  const loadLessons = async (moduleId) => {
    const { data } = await supabase
      .from("lessons")
      .select("*")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: true });
    setLessons(data || []);
  };

  // --- MÉTODOS DE CREACIÓN ---

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseTitle) return;

    setUploading(true);
    let thumbnailUrl = null;

    // Subir la imagen si fue seleccionada
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, imageFile);

      if (uploadError) {
        alert('Error al subir la imagen a la base de datos: ' + uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

      thumbnailUrl = data.publicUrl;
    }

    const { data, error } = await supabase
      .from("courses")
      .insert({
        title: newCourseTitle,
        description: newCourseDesc,
        thumbnail_url: thumbnailUrl
      })
      .select()
      .single();

    if (!error && data) {
      setNewCourseTitle("");
      setNewCourseDesc("");
      setImageFile(null);
      
      // Limpiar input file del DOM manualmente
      const fileInput = document.getElementById('course-thumbnail-input');
      if (fileInput) fileInput.value = "";

      await loadCourses();
      setSelectedCourse(data);
      await loadModules(data.id);
    }
    setUploading(false);
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle || !selectedCourse) return;

    const { error } = await supabase
      .from("modules")
      .insert({
        course_id: selectedCourse.id,
        title: newModuleTitle,
        order_index: modules.length + 1
      });

    if (!error) {
      setNewModuleTitle("");
      await loadModules(selectedCourse.id);
    }
  };

  const handleAddResource = (e) => {
    e.preventDefault();
    if (!resName || !resUrl) return;
    setNewLessonResources([...newLessonResources, { name: resName, url: resUrl }]);
    setResName("");
    setResUrl("");
  };

  const handleRemoveResource = (index) => {
    setNewLessonResources(newLessonResources.filter((_, i) => i !== index));
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!newLessonTitle || !newLessonVimeoId || !selectedModule) return;

    const { error } = await supabase
      .from("lessons")
      .insert({
        module_id: selectedModule.id,
        title: newLessonTitle,
        description: newLessonDesc,
        vimeo_id: newLessonVimeoId,
        order_index: lessons.length + 1,
        resources: newLessonResources
      });

    if (!error) {
      setNewLessonTitle("");
      setNewLessonDesc("");
      setNewLessonVimeoId("");
      setNewLessonResources([]);
      await loadLessons(selectedModule.id);
    }
  };

  // --- MÉTODOS DE BORRADO ---

  const handleDeleteCourse = async (course) => {
    if (!confirm(`¿Seguro que deseas eliminar el curso "${course.title}" y todo su contenido?`)) return;
    
    // Si el curso tiene una miniatura cargada en storage, intentar borrarla también
    if (course.thumbnail_url) {
      try {
        const urlParts = course.thumbnail_url.split('/storage/v1/object/public/thumbnails/');
        if (urlParts.length === 2) {
          const fileName = urlParts[1];
          await supabase.storage.from('thumbnails').remove([fileName]);
        }
      } catch (err) {
        console.error("Error al borrar la imagen de storage:", err);
      }
    }

    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (!error) {
      if (selectedCourse?.id === course.id) {
        setSelectedCourse(null);
        setModules([]);
        setLessons([]);
      }
      await loadCourses();
    }
  };

  const handleDeleteModule = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este módulo y todas sus lecciones?")) return;
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (!error) {
      if (selectedModule?.id === id) {
        setSelectedModule(null);
        setLessons([]);
      }
      await loadModules(selectedCourse.id);
    }
  };

  const handleDeleteLesson = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar esta lección?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (!error) {
      await loadLessons(selectedModule.id);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem" }}>Verificando administrador...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button 
            onClick={() => router.push("/courses")} 
            className="btn btn-secondary"
            style={{ padding: "8px 12px", fontSize: "0.85rem" }}
          >
            <ArrowLeft size={16} /> Ir al Catálogo
          </button>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "#F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
              Panel de Administración
            </div>
            <span style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Triangulo Academy
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Admin: <strong style={{ color: "#fff" }}>{profile?.full_name}</strong>
          </span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="btn btn-danger" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* Admin Panel Grid */}
      <div style={{ 
        flex: 1, 
        padding: "40px", 
        display: "grid", 
        gridTemplateColumns: "350px 1fr", 
        gap: "30px",
        maxWidth: "1600px",
        width: "100%",
        margin: "0 auto"
      }}>
        {/* Columna Izquierda: Cursos */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          {/* Creador de Cursos */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.1rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <BookOpen size={18} style={{ color: "var(--primary)" }} /> Crear Nuevo Curso
            </h3>
            
            <form onSubmit={handleCreateCourse} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Título del Curso</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. Photoshop desde Cero" 
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Descripción</label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: "80px", resize: "none" }}
                  placeholder="Descripción resumida..." 
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Miniatura del Curso</label>
                <input 
                  id="course-thumbnail-input"
                  type="file" 
                  accept="image/*"
                  className="form-input" 
                  onChange={(e) => setImageFile(e.target.files[0] || null)}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                  Selecciona una imagen de tu computadora.
                </span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={uploading}>
                {uploading ? "Subiendo miniatura..." : (
                  <>
                    <Plus size={16} /> Agregar Curso
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Listado de Cursos */}
          <div className="glass-card" style={{ flex: 1, maxHeight: "500px", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Cursos de la Academia</h3>
            {courses.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No hay cursos activos.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {courses.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={async () => {
                      setSelectedCourse(c);
                      await loadModules(c.id);
                    }}
                    style={{
                      padding: "16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid",
                      borderColor: selectedCourse?.id === c.id ? "var(--primary)" : "var(--border)",
                      backgroundColor: selectedCourse?.id === c.id ? "rgba(167,219,0,0.05)" : "rgba(255,255,255,0.01)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "var(--transition)"
                    }}
                  >
                    <div style={{ overflow: "hidden", flex: 1, marginRight: "10px" }}>
                      <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{c.title}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{c.description ? "Con descripción" : "Sin descripción"}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c); }}
                      style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Columna Derecha: Gestión de Módulos y Lecciones */}
        <main>
          {selectedCourse ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              {/* Info del curso seleccionado */}
              <div className="glass-card" style={{ padding: "20px 30px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600", textTransform: "uppercase" }}>Curso Seleccionado</span>
                <h2 style={{ fontSize: "1.6rem", marginTop: "4px" }}>{selectedCourse.title}</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>{selectedCourse.description}</p>
              </div>

              {/* Grid Interno: Módulos a la izquierda, Lecciones a la derecha */}
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "30px" }}>
                {/* Panel de Módulos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Crear Módulo */}
                  <div className="glass-card" style={{ padding: "20px" }}>
                    <h4 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <FolderPlus size={16} style={{ color: "var(--primary)" }} /> Nuevo Módulo
                    </h4>
                    <form onSubmit={handleCreateModule} style={{ display: "flex", gap: "10px" }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Nombre del módulo..." 
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: "10px" }}>
                        <Plus size={16} />
                      </button>
                    </form>
                  </div>

                  {/* Listado de Módulos */}
                  <div className="glass-card" style={{ padding: "20px", maxHeight: "400px", overflowY: "auto" }}>
                    <h4 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Layers size={16} /> Módulos ({modules.length})
                    </h4>
                    {modules.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aún no hay módulos creados.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {modules.map((m) => (
                          <div 
                            key={m.id}
                            onClick={async () => {
                              setSelectedModule(m);
                              await loadLessons(m.id);
                            }}
                            style={{
                              padding: "12px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid",
                              borderColor: selectedModule?.id === m.id ? "var(--primary)" : "var(--border)",
                              backgroundColor: selectedModule?.id === m.id ? "rgba(167,219,0,0.05)" : "transparent",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <span style={{ fontSize: "0.9rem", fontWeight: "500", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {m.order_index}. {m.title}
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteModule(m.id); }}
                              style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", padding: "2px" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel de Lecciones */}
                <div>
                  {selectedModule ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
                      {/* Creador de Lecciones */}
                      <div className="glass-card">
                        <h4 style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Video size={18} style={{ color: "var(--primary)" }} /> Añadir Lección a: {selectedModule.title}
                        </h4>
                        
                        <form onSubmit={handleCreateLesson} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "16px" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Título de la Clase</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="ej. Introducción a la Interfaz" 
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Vimeo ID (Numérico)</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="ej. 85642145" 
                                value={newLessonVimeoId}
                                onChange={(e) => setNewLessonVimeoId(e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Descripción</label>
                            <textarea 
                              className="form-input" 
                              style={{ minHeight: "60px", resize: "none" }}
                              placeholder="Breve explicación de los temas explicados en esta lección..." 
                              value={newLessonDesc}
                              onChange={(e) => setNewLessonDesc(e.target.value)}
                            />
                          </div>

                          {/* Gestión de Recursos para la lección */}
                          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
                            <label className="form-label" style={{ display: "block", marginBottom: "10px" }}>Recursos / Enlaces Canva</label>
                            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ flex: 1 }}
                                placeholder="Nombre (ej. Enlace de Práctica)" 
                                value={resName}
                                onChange={(e) => setResName(e.target.value)}
                              />
                              <input 
                                type="url" 
                                className="form-input" 
                                style={{ flex: 2 }}
                                placeholder="URL (https://canva.com/...)" 
                                value={resUrl}
                                onChange={(e) => setResUrl(e.target.value)}
                              />
                              <button onClick={handleAddResource} className="btn btn-secondary" style={{ padding: "0 16px" }}>
                                Añadir
                              </button>
                            </div>
                            {newLessonResources.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {newLessonResources.map((r, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
                                    <span>{r.name} - <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>Enlace</a></span>
                                    <button type="button" onClick={() => handleRemoveResource(i)} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer" }}>
                                      Eliminar
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <button type="submit" className="btn btn-primary">
                            <Plus size={16} /> Agregar Lección
                          </button>
                        </form>
                      </div>

                      {/* Listado de Lecciones */}
                      <div className="glass-card">
                        <h4 style={{ marginBottom: "16px" }}>Lecciones en este Módulo</h4>
                        {lessons.length === 0 ? (
                          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No hay lecciones en este módulo.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {lessons.map((l) => (
                              <div 
                                key={l.id}
                                style={{
                                  padding: "16px",
                                  backgroundColor: "rgba(255,255,255,0.02)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-md)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: "0.95rem" }}>{l.order_index}. {l.title}</strong>
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Vimeo ID: {l.vimeo_id} | Recursos: {l.resources?.length || 0}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleDeleteLesson(l.id)}
                                  style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", padding: "4px" }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                      <p style={{ color: "var(--text-secondary)" }}>Selecciona un módulo de la lista para ver o añadir lecciones.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ textAlign: "center", padding: "100px 40px" }}>
              <BookOpen size={40} style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
              <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>Selecciona un curso</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Haz clic en un curso del listado de la izquierda para comenzar a gestionar sus módulos, lecciones y recursos.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
