import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log('[Webhook] Received event:', JSON.stringify(body, null, 2));

    const { event, instance, data } = body;

    if (!instance || !event) {
      console.log('[Webhook] Missing instance or event');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the instance in database
    const { data: whatsappInstance } = await supabase
      .from('whatsapp_instances')
      .select('id, company_id')
      .eq('instance_name', instance)
      .maybeSingle();

    if (!whatsappInstance) {
      console.log(`[Webhook] Instance not found: ${instance}`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (event) {
      case 'connection.update': {
        const state = data?.state || data?.status;
        const status = state === 'open' ? 'connected' : 'disconnected';
        
        console.log(`[Webhook] Connection update: ${instance} -> ${status}`);
        
        await supabase
          .from('whatsapp_instances')
          .update({ status })
          .eq('id', whatsappInstance.id);
        break;
      }

      case 'messages.upsert': {
        const messages = data?.messages || [data];
        
        for (const msg of messages) {
          // Skip if it's from us or no content
          if (msg.key?.fromMe || !msg.message) continue;

          const phone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
          if (!phone) continue;

          // Extract message text
          let messageBody = '';
          if (msg.message?.conversation) {
            messageBody = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            messageBody = msg.message.extendedTextMessage.text;
          } else if (msg.message?.imageMessage?.caption) {
            messageBody = `[Imagem] ${msg.message.imageMessage.caption || ''}`;
          } else if (msg.message?.videoMessage?.caption) {
            messageBody = `[Vídeo] ${msg.message.videoMessage.caption || ''}`;
          } else if (msg.message?.audioMessage) {
            messageBody = '[Áudio]';
          } else if (msg.message?.documentMessage) {
            messageBody = `[Documento] ${msg.message.documentMessage.fileName || ''}`;
          } else if (msg.message?.stickerMessage) {
            messageBody = '[Sticker]';
          } else if (msg.message?.contactMessage) {
            messageBody = `[Contato] ${msg.message.contactMessage.displayName || ''}`;
          } else if (msg.message?.locationMessage) {
            messageBody = '[Localização]';
          } else {
            console.log('[Webhook] Unknown message type:', Object.keys(msg.message || {}));
            continue;
          }

          if (!messageBody) continue;

          console.log(`[Webhook] New message from ${phone}: ${messageBody.substring(0, 50)}...`);

          // Find or create conversation
          let { data: conversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('phone', phone)
            .eq('company_id', whatsappInstance.company_id)
            .maybeSingle();

          if (!conversation) {
            const { data: newConversation, error: convError } = await supabase
              .from('conversations')
              .insert({
                phone,
                company_id: whatsappInstance.company_id,
                instance_id: whatsappInstance.id,
                status: 'open',
              })
              .select('id')
              .single();

            if (convError) {
              console.error('[Webhook] Error creating conversation:', convError);
              continue;
            }
            conversation = newConversation;
          } else {
            // Reopen conversation if closed
            await supabase
              .from('conversations')
              .update({ status: 'open', updated_at: new Date().toISOString() })
              .eq('id', conversation.id);
          }

          // Save message
          const { error: msgError } = await supabase.from('messages').insert({
            conversation_id: conversation.id,
            from_me: false,
            body: messageBody,
          });

          if (msgError) {
            console.error('[Webhook] Error saving message:', msgError);
          }
        }
        break;
      }

      case 'messages.update': {
        console.log('[Webhook] Message update event - ignored');
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
