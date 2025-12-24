import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Smartphone, Pencil, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  created_at: string;
}

export default function Instances() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editInstanceName, setEditInstanceName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInstances = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as instâncias.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, [profile?.company_id]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim() || !profile?.company_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .insert({
          company_id: profile.company_id,
          instance_name: newInstanceName.trim(),
          status: 'disconnected',
        });

      if (error) throw error;

      toast({
        title: 'Instância criada',
        description: 'A nova instância foi criada com sucesso.',
      });

      setNewInstanceName('');
      setIsCreateDialogOpen(false);
      fetchInstances();
    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a instância.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditInstance = async () => {
    if (!editInstanceName.trim() || !editingInstance) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ instance_name: editInstanceName.trim() })
        .eq('id', editingInstance.id);

      if (error) throw error;

      toast({
        title: 'Instância atualizada',
        description: 'O nome da instância foi atualizado.',
      });

      setIsEditDialogOpen(false);
      setEditingInstance(null);
      fetchInstances();
    } catch (error) {
      console.error('Error updating instance:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a instância.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (instance: WhatsAppInstance) => {
    setEditingInstance(instance);
    setEditInstanceName(instance.instance_name);
    setIsEditDialogOpen(true);
  };

  return (
    <DashboardLayout title="Instâncias WhatsApp">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Gerencie suas conexões com o WhatsApp
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
                <DialogDescription>
                  Dê um nome para sua nova instância WhatsApp.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="instance-name">Nome da Instância</Label>
                  <Input
                    id="instance-name"
                    placeholder="Ex: Suporte Principal"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateInstance} disabled={saving || !newInstanceName.trim()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Instances Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instances.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Smartphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma instância</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Crie sua primeira instância WhatsApp para começar a receber mensagens.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Instância
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((instance) => (
              <Card key={instance.id} className="border-border/50 transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${
                      instance.status === 'connected' ? 'bg-success/10' : 'bg-muted'
                    }`}>
                      {instance.status === 'connected' ? (
                        <Wifi className="h-4 w-4 text-success" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{instance.instance_name}</CardTitle>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(instance)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={instance.status === 'connected' ? 'default' : 'secondary'}
                    className={instance.status === 'connected' ? 'bg-success hover:bg-success/90' : ''}
                  >
                    {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Instância</DialogTitle>
              <DialogDescription>
                Altere o nome da instância.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-instance-name">Nome da Instância</Label>
                <Input
                  id="edit-instance-name"
                  value={editInstanceName}
                  onChange={(e) => setEditInstanceName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditInstance} disabled={saving || !editInstanceName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
