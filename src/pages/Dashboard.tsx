import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, MessageSquare, Smartphone, Users, Building2 } from 'lucide-react';

interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  connectedInstances: number;
  totalInstances: number;
  totalUsers: number;
}

export default function Dashboard() {
  const { company, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    openConversations: 0,
    connectedInstances: 0,
    totalInstances: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('company_id', profile.company_id);

        // Fetch instances
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('id, status')
          .eq('company_id', profile.company_id);

        // Fetch users
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', profile.company_id);

        setStats({
          totalConversations: conversations?.length || 0,
          openConversations: conversations?.filter(c => c.status === 'open').length || 0,
          connectedInstances: instances?.filter(i => i.status === 'connected').length || 0,
          totalInstances: instances?.length || 0,
          totalUsers: users?.length || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile?.company_id]);

  const statCards = [
    {
      title: 'Total de Conversas',
      value: stats.totalConversations,
      icon: MessageCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Conversas Abertas',
      value: stats.openConversations,
      icon: MessageSquare,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Instâncias Conectadas',
      value: `${stats.connectedInstances}/${stats.totalInstances}`,
      icon: Smartphone,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Usuários',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent',
    },
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Company Info */}
        {company && (
          <Card className="border-border/50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Bem-vindo ao seu painel de atendimento
                </p>
              </div>
              <Badge variant="secondary" className="text-sm">
                Plano {company.plan}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="border-border/50 transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions or Empty State */}
        {!loading && stats.totalConversations === 0 && (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma conversa ainda</h3>
              <p className="text-muted-foreground max-w-md">
                Quando seus clientes entrarem em contato via WhatsApp, as conversas aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
