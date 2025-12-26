import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  Shield, 
  Pencil, 
  Trash2, 
  Loader2,
  Plus,
  UserCog
} from 'lucide-react';

interface User {
  id: string;
  full_name: string | null;
  company_id: string | null;
  company_name?: string;
  role?: string;
}

interface Company {
  id: string;
  name: string;
  plan: string;
  active: boolean;
  created_at: string;
  user_count?: number;
}

export default function Admin() {
  const { profile } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dialogs
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  
  // Edit states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('agent');

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/dashboard');
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      // Fetch users with their company info
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          company_id
        `)
        .eq('company_id', profile.company_id);

      if (profilesError) throw profilesError;

      // Fetch roles for users
      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const usersWithRoles = profilesData?.map(user => ({
        ...user,
        role: rolesData?.find(r => r.user_id === user.id)?.role || 'agent'
      })) || [];

      setUsers(usersWithRoles);

      // Fetch companies (admin can see all companies - need to use service role or adjust RLS)
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, profile?.company_id]);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedCompanyId(user.company_id || '');
    setSelectedRole(user.role || 'agent');
    setIsEditUserOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      // Update profile company
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: selectedCompanyId || null })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update or insert role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', editingUser.id)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update({ role: selectedRole as 'admin' | 'agent' })
          .eq('user_id', editingUser.id);
      } else {
        await supabase
          .from('user_roles')
          .insert([{ user_id: editingUser.id, role: selectedRole as 'admin' | 'agent' }]);
      }

      toast({
        title: 'Usuário atualizado',
        description: 'As informações do usuário foram atualizadas.',
      });
      setIsEditUserOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsEditCompanyOpen(true);
  };

  const handleSaveCompany = async () => {
    if (!editingCompany) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ 
          name: editingCompany.name,
          plan: editingCompany.plan,
          active: editingCompany.active
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      toast({
        title: 'Empresa atualizada',
        description: 'As informações da empresa foram atualizadas.',
      });
      setIsEditCompanyOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a empresa.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .insert({ name: newCompanyName.trim() });

      if (error) throw error;

      toast({
        title: 'Empresa criada',
        description: 'A nova empresa foi criada com sucesso.',
      });
      setNewCompanyName('');
      setIsCreateCompanyOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a empresa.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <DashboardLayout title="Administração">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout title="Administração">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Gerenciar Usuários
                </CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário encontrado na sua empresa.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name || 'Sem nome'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              <Shield className="h-3 w-3 mr-1" />
                              {user.role === 'admin' ? 'Admin' : 'Agente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsCreateCompanyOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma empresa cadastrada.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{company.plan}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={company.active ? 'default' : 'secondary'}>
                              {company.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCompany(company)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Altere as configurações do usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editingUser?.full_name || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Company Dialog */}
        <Dialog open={isEditCompanyOpen} onOpenChange={setIsEditCompanyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>
                Altere as informações da empresa.
              </DialogDescription>
            </DialogHeader>
            {editingCompany && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input 
                    value={editingCompany.name} 
                    onChange={(e) => setEditingCompany({...editingCompany, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select 
                    value={editingCompany.plan} 
                    onValueChange={(value) => setEditingCompany({...editingCompany, plan: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editingCompany.active ? 'active' : 'inactive'} 
                    onValueChange={(value) => setEditingCompany({...editingCompany, active: value === 'active'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditCompanyOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCompany} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Company Dialog */}
        <Dialog open={isCreateCompanyOpen} onOpenChange={setIsCreateCompanyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Empresa</DialogTitle>
              <DialogDescription>
                Crie uma nova empresa no sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input 
                  value={newCompanyName} 
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: Minha Empresa LTDA"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateCompanyOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCompany} disabled={saving || !newCompanyName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
