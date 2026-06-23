"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LogOut, BookOpen, Settings, ArrowRight } from "lucide-react";

export default function CoursesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);

      // Cargar Perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);

      // Cargar Cursos
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && coursesData) {
        setCourses(coursesData);
      }
      setLoading(false);
    };

    initData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem" }}>Cargando academia...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Background decoration */}
      <div className="glow-blur" style={{ top: "0%", right: "10%" }}></div>
      <div className="glow-blur" style={{ bottom: "0%", left: "10%", background: "rgba(255,255,255,0.01)" }}></div>

      {/* Header */}
      <header style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div onClick={() => router.push("/courses")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--primary)" }}>▲</span> Triangulo
          </div>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "var(--primary)", fontWeight: "600", marginTop: "-3px" }}>
            ACADEMY
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {profile?.role === "admin" && (
            <button 
              onClick={() => router.push("/admin")} 
              className="btn btn-secondary" 
              style={{ padding: "8px 16px", fontSize: "0.85rem" }}
            >
              <Settings size={16} /> Panel Admin
            </button>
          )}

          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Hola, <strong style={{ color: "var(--text-primary)" }}>{profile?.full_name || user?.email}</strong>
          </div>

          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* Main Catalog */}
      <main style={{ flex: 1, padding: "50px 40px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2.2rem", marginBottom: "8px" }}>Nuestros Cursos</h1>
          <p style={{ color: "var(--text-secondary)" }}>Explora nuestro catálogo y empieza a aprender habilidades digitales hoy mismo.</p>
        </div>

        {courses.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "60px 40px" }}>
            <BookOpen size={48} style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
            <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>Aún no hay cursos cargados</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
              {profile?.role === "admin" 
                ? "Como administrador, puedes ir a tu panel para crear el primer curso de la academia."
                : "Muy pronto se cargarán las lecciones y cursos. Vuelve a revisar más tarde."}
            </p>
            {profile?.role === "admin" && (
              <button onClick={() => router.push("/admin")} className="btn btn-primary">
                Crear Curso <ArrowRight size={18} />
              </button>
            )}
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map((course) => (
              <div 
                key={course.id} 
                className="course-card" 
                onClick={() => router.push(`/courses/${course.id}`)}
              >
                <div 
                  className="course-thumbnail" 
                  style={{ 
                    backgroundImage: course.thumbnail_url 
                      ? `url('${course.thumbnail_url}')` 
                      : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    backgroundColor: "#1c242f"
                  }}
                >
                  {!course.thumbnail_url && <BookOpen size={40} />}
                </div>
                <div className="course-card-content">
                  <h3 className="course-title">{course.title}</h3>
                  <p className="course-desc">
                    {course.description || "Sin descripción proporcionada."}
                  </p>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginTop: "auto",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border)"
                  }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: "600" }}>Ingresar al curso</span>
                    <ArrowRight size={16} style={{ color: "var(--primary)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "30px",
        borderTop: "1px solid var(--border)",
        color: "var(--text-muted)",
        fontSize: "0.85rem"
      }}>
        © {new Date().getFullYear()} Triangulo Academy. Todos los derechos reservados.
      </footer>
    </div>
  );
}
