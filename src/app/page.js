"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirigir si ya tiene sesión activa
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        redirectUser(session.user.id);
      }
    };
    checkUser();
  }, []);

  const redirectUser = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (profile?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/courses");
      }
    } catch (err) {
      // Si el perfil no existe todavía (por ejemplo, el trigger tarda un instante), redirigir por defecto a cursos
      router.push("/courses");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (isSignUp) {
      // Registro
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Si requiere confirmación de email, Supabase devolverá usuario pero no sesión abierta
      if (data?.user && data?.session === null) {
        setMessage("¡Registro exitoso! Por favor revisa tu correo electrónico para confirmar tu cuenta.");
        setEmail("");
        setPassword("");
        setFullName("");
      } else if (data?.user && data?.session) {
        redirectUser(data.user.id);
      }
    } else {
      // Inicio de Sesión
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        redirectUser(data.user.id);
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      {/* Background glow decoration */}
      <div className="glow-blur" style={{ top: "10%", left: "15%" }}></div>
      <div className="glow-blur" style={{ bottom: "10%", right: "15%", background: "rgba(255, 255, 255, 0.03)" }}></div>

      <div className="auth-box">
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "#F3F4F6", display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "var(--primary)" }}>▲</span> TRIANGULO
          </div>
          <div style={{ fontSize: "0.9rem", letterSpacing: "0.3em", color: "var(--primary)", fontWeight: "600", marginTop: "-5px" }}>
            ACADEMY
          </div>
        </div>

        <div className="glass-card">
          <h2 style={{ fontSize: "1.5rem", marginBottom: "24px", textAlign: "center" }}>
            {isSignUp ? "Crear cuenta de estudiante" : "Iniciar sesión en la academia"}
          </h2>

          {error && <div className="alert alert-danger">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <form onSubmit={handleAuth}>
            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tu nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isSignUp}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                className="form-input"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }} disabled={loading}>
              {loading ? "Procesando..." : isSignUp ? "Registrarse" : "Ingresar"}
            </button>
          </form>

          <div style={{ marginTop: "24px", textAlign: "center", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {isSignUp ? "¿Ya tienes una cuenta?" : "¿No tienes una cuenta de estudiante?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setMessage("");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                fontWeight: "600",
                cursor: "pointer",
                padding: "0 5px",
                fontFamily: "inherit"
              }}
            >
              {isSignUp ? "Inicia Sesión" : "Regístrate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
