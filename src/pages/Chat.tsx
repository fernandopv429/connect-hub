import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { ArrowLeft, Send, Phone, Clock, Loader2, CheckCheck, XCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
  id: string;
  from_me: boolean;
  body: string;
  created_at: string;
}

interface Conversation {
  id: string;
  phone: string;
  status: string;
  created_at: string;
  instance_id: string | null;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const evolution = useEvolutionApi();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closingConversation, setClosingConversation] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        navigate('/conversations');
        return;
      }
      setConversation(data);

      // Fetch associated instance
      if (data.instance_id) {
        const { data: instanceData } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', data.instance_id)
          .maybeSingle();
        
        if (instanceData) {
          setInstance(instanceData);
        }
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      navigate('/conversations');
    }
  };

  const fetchMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversation();
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !conversation) return;

    setSending(true);
    try {
      // If we have an instance connected, send via Evolution API
      if (instance && instance.status === 'connected') {
        const result = await evolution.sendMessage(
          instance.instance_name,
          conversation.phone,
          newMessage.trim(),
          conversationId
        );

        if (!result) {
          throw new Error(evolution.error || 'Erro ao enviar mensagem');
        }
        
        setNewMessage('');
      } else {
        // Fallback: just save to database (for testing or when instance is disconnected)
        const { error } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          from_me: true,
          body: newMessage.trim(),
        });

        if (error) throw error;
        setNewMessage('');
        
        if (!instance) {
          toast({
            title: 'Aviso',
            description: 'Mensagem salva, mas não enviada (nenhuma instância associada).',
          });
        } else {
          toast({
            title: 'Aviso', 
            description: 'Mensagem salva, mas não enviada (instância desconectada).',
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleConversationStatus = async () => {
    if (!conversation) return;
    
    setClosingConversation(true);
    const newStatus = conversation.status === 'open' ? 'closed' : 'open';
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ status: newStatus })
        .eq('id', conversation.id);

      if (error) throw error;
      
      setConversation({ ...conversation, status: newStatus });
      toast({
        title: newStatus === 'closed' ? 'Conversa fechada' : 'Conversa reaberta',
        description: newStatus === 'closed' 
          ? 'A conversa foi marcada como fechada.'
          : 'A conversa foi reaberta.',
      });
    } catch (error) {
      console.error('Error updating conversation:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a conversa.',
        variant: 'destructive',
      });
    } finally {
      setClosingConversation(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length >= 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (date: string) => {
    return format(new Date(date), "d 'de' MMMM", { locale: ptBR });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
        {/* Chat Header */}
        <Card className="rounded-b-none border-b-0">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/conversations')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {conversation ? formatPhone(conversation.phone) : 'Carregando...'}
                </span>
                {conversation && (
                  <Badge
                    variant={conversation.status === 'open' ? 'default' : 'secondary'}
                    className={conversation.status === 'open' ? 'bg-success hover:bg-success/90' : ''}
                  >
                    {conversation.status === 'open' ? 'Aberta' : 'Fechada'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {conversation && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Iniciada em {format(new Date(conversation.created_at), "d/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
                {instance && (
                  <span className="flex items-center gap-1">
                    •
                    <span className={instance.status === 'connected' ? 'text-success' : 'text-muted-foreground'}>
                      {instance.instance_name}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {conversation && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleConversationStatus}
                disabled={closingConversation}
              >
                {closingConversation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : conversation.status === 'open' ? (
                  <XCircle className="mr-2 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {conversation.status === 'open' ? 'Fechar' : 'Reabrir'}
              </Button>
            )}
          </div>
        </Card>

        {/* Messages Area */}
        <Card className="flex-1 rounded-none border-y-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 scrollbar-thin bg-muted/30">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground">Nenhuma mensagem ainda.</p>
                <p className="text-sm text-muted-foreground">Envie a primeira mensagem abaixo.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                  <div key={date}>
                    <div className="flex justify-center mb-4">
                      <Badge variant="secondary" className="text-xs">
                        {formatMessageDate(dateMessages[0].created_at)}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {dateMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                              message.from_me
                                ? 'bg-chat-outgoing rounded-br-md'
                                : 'bg-card rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                            <div className={`flex items-center gap-1 mt-1 ${message.from_me ? 'justify-end' : ''}`}>
                              <span className="text-xs text-muted-foreground">
                                {formatMessageTime(message.created_at)}
                              </span>
                              {message.from_me && (
                                <CheckCheck className="h-3 w-3 text-primary" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </Card>

        {/* Message Input */}
        <Card className="rounded-t-none border-t-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-4">
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
