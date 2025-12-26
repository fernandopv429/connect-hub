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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { 
  Plus, 
  Smartphone, 
  Pencil, 
  Wifi, 
  WifiOff, 
  Loader2, 
  QrCode, 
  RefreshCw,
  Power,
  Trash2,
  Link,
  Unlink
} from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  created_at: string;
}

export default function Instances() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const evolution = useEvolutionApi();
  
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstance | null>(null);
  const [deletingInstance, setDeletingInstance] = useState<WhatsAppInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editInstanceName, setEditInstanceName] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrInstanceName, setQrInstanceName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInstances = async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

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
    if (profile !== null) {
      fetchInstances();
    }
  }, [profile]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim() || !profile?.company_id) return;

    setSaving(true);
    try {
      const result = await evolution.createInstance(newInstanceName.trim());
      
      if (!result) {
        throw new Error(evolution.error || 'Erro ao criar instância');
      }

      toast({
        title: 'Instância criada',
        description: 'A nova instância foi criada. Conecte-a usando o QR Code.',
      });

      setNewInstanceName('');
      setIsCreateDialogOpen(false);
      fetchInstances();
    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível criar a instância.',
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

  const handleConnect = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    setQrInstanceName(instance.instance_name);
    
    try {
      const result = await evolution.getQRCode(instance.instance_name);
      
      if (!result) {
        throw new Error(evolution.error || 'Erro ao obter QR Code');
      }

      const qrBase64 = result.base64 || result.qrcode?.base64;
      if (qrBase64) {
        setQrCodeData(qrBase64);
        setIsQRDialogOpen(true);
      } else if (result.state === 'open' || result.instance?.state === 'open') {
        toast({
          title: 'Já conectado',
          description: 'Esta instância já está conectada.',
        });
        await supabase
          .from('whatsapp_instances')
          .update({ status: 'connected' })
          .eq('id', instance.id);
        fetchInstances();
      } else {
        throw new Error('QR Code não disponível');
      }
    } catch (error) {
      console.error('Error getting QR code:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível obter o QR Code.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshStatus = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    
    try {
      const result = await evolution.getStatus(instance.instance_name, instance.id);
      
      if (result) {
        toast({
          title: 'Status atualizado',
          description: `Status: ${result.status === 'connected' ? 'Conectado' : 'Desconectado'}`,
        });
        fetchInstances();
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    
    try {
      await evolution.disconnectInstance(instance.instance_name, instance.id);
      
      toast({
        title: 'Desconectado',
        description: 'A instância foi desconectada.',
      });
      fetchInstances();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desconectar a instância.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingInstance) return;
    
    setActionLoading(deletingInstance.id);
    
    try {
      await evolution.deleteInstance(deletingInstance.instance_name, deletingInstance.id);
      
      toast({
        title: 'Instância removida',
        description: 'A instância foi removida com sucesso.',
      });
      setIsDeleteDialogOpen(false);
      setDeletingInstance(null);
      fetchInstances();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a instância.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openEditDialog = (instance: WhatsAppInstance) => {
    setEditingInstance(instance);
    setEditInstanceName(instance.instance_name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (instance: WhatsAppInstance) => {
    setDeletingInstance(instance);
    setIsDeleteDialogOpen(true);
  };

  return (
    <DashboardLayout title="Instâncias WhatsApp">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Gerencie suas conexões com o WhatsApp via Evolution API
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
                  A instância será criada na Evolution API e você poderá conectá-la via QR Code.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="instance-name">Nome da Instância</Label>
                  <Input
                    id="instance-name"
                    placeholder="Ex: suporte-principal (sem espaços)"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value.replace(/\s/g, '-').toLowerCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras, números e hífens. Sem espaços.
                  </p>
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
        ) : !profile?.company_id ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <Smartphone className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Empresa não configurada</h3>
              <p className="text-muted-foreground max-w-md">
                Seu perfil não está associado a uma empresa. Entre em contato com o administrador.
              </p>
            </CardContent>
          </Card>
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(instance)}
                      disabled={actionLoading === instance.id}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(instance)}
                      disabled={actionLoading === instance.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Badge
                    variant={instance.status === 'connected' ? 'default' : 'secondary'}
                    className={instance.status === 'connected' ? 'bg-success hover:bg-success/90' : ''}
                  >
                    {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                  
                  <div className="flex flex-wrap gap-2">
                    {instance.status !== 'connected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConnect(instance)}
                        disabled={actionLoading === instance.id}
                      >
                        {actionLoading === instance.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        Conectar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDisconnect(instance)}
                        disabled={actionLoading === instance.id}
                      >
                        {actionLoading === instance.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="mr-2 h-4 w-4" />
                        )}
                        Desconectar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefreshStatus(instance)}
                      disabled={actionLoading === instance.id}
                    >
                      <RefreshCw className={`h-4 w-4 ${actionLoading === instance.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
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
                Altere o nome da instância no banco de dados.
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

        {/* QR Code Dialog */}
        <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com o WhatsApp para conectar a instância "{qrInstanceName}".
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-6">
              {qrCodeData ? (
                <img 
                  src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                  alt="QR Code" 
                  className="w-64 h-64 rounded-lg border"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsQRDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover instância?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá remover a instância "{deletingInstance?.instance_name}" permanentemente.
                As conversas associadas serão mantidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading === deletingInstance?.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
