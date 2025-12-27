-- 1. Remover políticas duplicadas em user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

-- 2. Super admins podem ver todos os profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Super admins podem atualizar todos os profiles  
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Admins podem deletar empresas
CREATE POLICY "Admins can delete companies"
ON public.companies FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Garantir que admins podem gerenciar roles globalmente
DROP POLICY IF EXISTS "Admins can manage roles in their company" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));