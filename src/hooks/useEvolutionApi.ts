import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EvolutionResponse {
  success?: boolean;
  error?: string;
  qrcode?: {
    base64?: string;
    code?: string;
  };
  base64?: string;
  code?: string;
  state?: string;
  status?: string;
  instance?: {
    instanceName?: string;
    state?: string;
  };
}

type EvolutionAction = 'create' | 'connect' | 'disconnect' | 'status' | 'qrcode' | 'send' | 'delete' | 'logout';

export function useEvolutionApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callEvolutionApi = useCallback(async (
    action: EvolutionAction,
    params: {
      instanceName?: string;
      instanceId?: string;
      phone?: string;
      message?: string;
      conversationId?: string;
    } = {}
  ): Promise<EvolutionResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('evolution-api', {
        body: { action, ...params },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('[Evolution API Hook] Error:', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createInstance = useCallback((instanceName: string) => {
    return callEvolutionApi('create', { instanceName });
  }, [callEvolutionApi]);

  const connectInstance = useCallback((instanceName: string) => {
    return callEvolutionApi('connect', { instanceName });
  }, [callEvolutionApi]);

  const getQRCode = useCallback((instanceName: string) => {
    return callEvolutionApi('qrcode', { instanceName });
  }, [callEvolutionApi]);

  const getStatus = useCallback((instanceName: string, instanceId?: string) => {
    return callEvolutionApi('status', { instanceName, instanceId });
  }, [callEvolutionApi]);

  const disconnectInstance = useCallback((instanceName: string, instanceId?: string) => {
    return callEvolutionApi('logout', { instanceName, instanceId });
  }, [callEvolutionApi]);

  const deleteInstance = useCallback((instanceName: string, instanceId?: string) => {
    return callEvolutionApi('delete', { instanceName, instanceId });
  }, [callEvolutionApi]);

  const sendMessage = useCallback((
    instanceName: string,
    phone: string,
    message: string,
    conversationId?: string
  ) => {
    return callEvolutionApi('send', { instanceName, phone, message, conversationId });
  }, [callEvolutionApi]);

  return {
    loading,
    error,
    createInstance,
    connectInstance,
    getQRCode,
    getStatus,
    disconnectInstance,
    deleteInstance,
    sendMessage,
  };
}
