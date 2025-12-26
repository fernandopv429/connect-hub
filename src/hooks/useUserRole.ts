import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'agent';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setRole(data?.role as AppRole || 'agent');
      } catch (error) {
        console.error('Error fetching role:', error);
        setRole('agent');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';

  return { role, isAdmin, loading };
}
