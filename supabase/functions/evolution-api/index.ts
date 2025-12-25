import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')!;
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EvolutionRequest {
  action: 'create' | 'connect' | 'disconnect' | 'status' | 'qrcode' | 'send' | 'delete' | 'logout';
  instanceName?: string;
  instanceId?: string;
  phone?: string;
  message?: string;
  conversationId?: string;
}

async function evolutionFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  console.log(`[Evolution API] Calling: ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
      ...options.headers,
    },
  });

  const data = await response.json();
  console.log(`[Evolution API] Response:`, JSON.stringify(data, null, 2));
  
  if (!response.ok) {
    throw new Error(data.message || `Evolution API error: ${response.status}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('User has no company');
    }

    const body: EvolutionRequest = await req.json();
    const { action, instanceName, instanceId, phone, message, conversationId } = body;

    console.log(`[Evolution API] Action: ${action}, Instance: ${instanceName || instanceId}`);

    let result;

    switch (action) {
      case 'create': {
        if (!instanceName) throw new Error('Instance name required');
        
        // Create instance in Evolution API
        result = await evolutionFetch('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });

        // Save to database
        const { data: instance, error: dbError } = await supabase
          .from('whatsapp_instances')
          .insert({
            company_id: profile.company_id,
            instance_name: instanceName,
            status: 'disconnected',
          })
          .select()
          .single();

        if (dbError) throw dbError;

        result = { ...result, instance };
        break;
      }

      case 'connect': {
        if (!instanceName) throw new Error('Instance name required');
        
        result = await evolutionFetch(`/instance/connect/${instanceName}`, {
          method: 'GET',
        });
        break;
      }

      case 'qrcode': {
        if (!instanceName) throw new Error('Instance name required');
        
        result = await evolutionFetch(`/instance/connect/${instanceName}`, {
          method: 'GET',
        });
        break;
      }

      case 'status': {
        if (!instanceName) throw new Error('Instance name required');
        
        result = await evolutionFetch(`/instance/connectionState/${instanceName}`, {
          method: 'GET',
        });

        // Update status in database
        const status = result.state === 'open' ? 'connected' : 'disconnected';
        
        if (instanceId) {
          await supabase
            .from('whatsapp_instances')
            .update({ status })
            .eq('id', instanceId)
            .eq('company_id', profile.company_id);
        }
        
        result = { ...result, status };
        break;
      }

      case 'disconnect': {
        if (!instanceName) throw new Error('Instance name required');
        
        result = await evolutionFetch(`/instance/logout/${instanceName}`, {
          method: 'DELETE',
        });

        // Update status in database
        if (instanceId) {
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'disconnected' })
            .eq('id', instanceId)
            .eq('company_id', profile.company_id);
        }
        break;
      }

      case 'logout': {
        if (!instanceName) throw new Error('Instance name required');
        
        result = await evolutionFetch(`/instance/logout/${instanceName}`, {
          method: 'DELETE',
        });

        if (instanceId) {
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'disconnected' })
            .eq('id', instanceId)
            .eq('company_id', profile.company_id);
        }
        break;
      }

      case 'delete': {
        if (!instanceName) throw new Error('Instance name required');
        
        // Delete from Evolution API
        try {
          result = await evolutionFetch(`/instance/delete/${instanceName}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.log('[Evolution API] Instance may not exist in Evolution:', e);
        }

        // Delete from database
        if (instanceId) {
          await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('id', instanceId)
            .eq('company_id', profile.company_id);
        }
        
        result = { success: true };
        break;
      }

      case 'send': {
        if (!instanceName || !phone || !message) {
          throw new Error('Instance name, phone and message required');
        }
        
        // Format phone number (remove non-numeric and ensure country code)
        const formattedPhone = phone.replace(/\D/g, '');
        
        result = await evolutionFetch(`/message/sendText/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        // Save message to database if conversationId provided
        if (conversationId) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            from_me: true,
            body: message,
          });
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Evolution API] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
