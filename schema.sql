-- 1. Tabla de Perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver perfiles propios" ON public.profiles;
CREATE POLICY "Ver perfiles propios" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Actualizar perfiles propios" ON public.profiles;
CREATE POLICY "Actualizar perfiles propios" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Tabla de Cursos
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cualquier usuario autenticado puede ver los cursos" ON public.courses;
CREATE POLICY "Cualquier usuario autenticado puede ver los cursos" 
  ON public.courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Solo administradores pueden crear/modificar cursos" ON public.courses;
CREATE POLICY "Solo administradores pueden crear/modificar cursos" 
  ON public.courses FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. Tabla de Módulos (para agrupar lecciones dentro de un curso)
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cualquier usuario autenticado puede ver módulos" ON public.modules;
CREATE POLICY "Cualquier usuario autenticado puede ver módulos" 
  ON public.modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Solo administradores pueden gestionar módulos" ON public.modules;
CREATE POLICY "Solo administradores pueden gestionar módulos" 
  ON public.modules FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 4. Tabla de Lecciones
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.modules ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  vimeo_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  resources JSONB DEFAULT '[]'::jsonb, -- [{name: "Recurso", url: "https://..."}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cualquier usuario autenticado puede ver lecciones" ON public.lessons;
CREATE POLICY "Cualquier usuario autenticado puede ver lecciones" 
  ON public.lessons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Solo administradores pueden gestionar lecciones" ON public.lessons;
CREATE POLICY "Solo administradores pueden gestionar lecciones" 
  ON public.lessons FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 5. Tabla de Progreso
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE NOT NULL,
  lesson_id UUID REFERENCES public.lessons ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios ven su propio progreso" ON public.user_progress;
CREATE POLICY "Los usuarios ven su propio progreso" 
  ON public.user_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios marcan su propio progreso" ON public.user_progress;
CREATE POLICY "Los usuarios marcan su propio progreso" 
  ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios borran su propio progreso" ON public.user_progress;
CREATE POLICY "Los usuarios borran su propio progreso" 
  ON public.user_progress FOR DELETE USING (auth.uid() = user_id);

-- Trigger para crear perfil automáticamente al registrarse un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- CONFIGURACIÓN DE STORAGE (Para carga de imágenes/miniaturas)
-- =========================================================================

-- Crear el bucket de miniaturas si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de imágenes del bucket 'thumbnails'
DROP POLICY IF EXISTS "Miniaturas públicas" ON storage.objects;
CREATE POLICY "Miniaturas públicas" 
  ON storage.objects FOR SELECT 
  TO public
  USING (bucket_id = 'thumbnails');

-- Permitir a administradores subir imágenes al bucket 'thumbnails'
DROP POLICY IF EXISTS "Solo administradores pueden subir miniaturas" ON storage.objects;
CREATE POLICY "Solo administradores pueden subir miniaturas" 
  ON storage.objects FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'thumbnails' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Permitir a administradores borrar imágenes del bucket 'thumbnails'
DROP POLICY IF EXISTS "Solo administradores pueden borrar miniaturas" ON storage.objects;
CREATE POLICY "Solo administradores pueden borrar miniaturas" 
  ON storage.objects FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'thumbnails' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
