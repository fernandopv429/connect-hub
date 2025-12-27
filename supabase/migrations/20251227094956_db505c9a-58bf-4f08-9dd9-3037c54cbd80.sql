-- Corrigir recursão infinita nas políticas de profiles
-- O problema é que as políticas antigas consultam profiles diretamente E user_roles

-- 1. Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update company profiles" ON public.profiles;

-- 2. Remover políticas que eu acabei de criar (vamos recriar de forma correta)
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;

-- 3. Criar políticas corretas usando APENAS has_role (security definer)
-- Admins podem ver todos os profiles da sua empresa
CREATE POLICY "Admins can view company profiles"
ON public.profiles FOR SELECT
USING (
  id = auth.uid() 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  )
);

-- Admins podem atualizar profiles da sua empresa
CREATE POLICY "Admins can update company profiles"
ON public.profiles FOR UPDATE
USING (
  id = auth.uid() 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  )
)
WITH CHECK (
  id = auth.uid() 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND company_id = get_user_company_id(auth.uid())
  )
);

-- 4. Corrigir política de user_roles para usar has_role em vez de subquery
DROP POLICY IF EXISTS "Users can view roles in their company" ON public.user_roles;

CREATE POLICY "Users can view roles in their company"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);