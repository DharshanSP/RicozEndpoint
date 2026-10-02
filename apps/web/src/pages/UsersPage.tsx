import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUsersList, useCreateUser, useUpdateUser } from '../hooks/useUsers';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Mail,
  X,
  Lock,
  User,
  SlidersHorizontal,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { formatDateTime } from '../lib/format';
import type { UserRole } from '../context/AuthContext';
import type { UserSummary } from '../lib/api/usersApi';

type RoleBadgeVariant = 'purple' | 'info' | 'warning' | 'secondary';

function getRoleBadgeVariant(role: string): RoleBadgeVariant {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'purple';
    case 'ORG_ADMIN':
    case 'IT_ADMIN':
      return 'info';
    case 'OPERATOR':
      return 'warning';
    default:
      return 'secondary';
  }
}

export function UsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const { data: users = [], isLoading, isFetching, error, refetch } = useUsersList();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERATOR');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('OPERATOR');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Status Toggle Confirmation & Feedback State
  const [userToToggle, setUserToToggle] = useState<UserSummary | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canManageUsers = hasRole(['SUPER_ADMIN', 'ORG_ADMIN']);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return;
    setCreateError(null);

    if (!newEmail || !newName || !newPassword) {
      setCreateError('Please complete all required fields.');
      return;
    }

    try {
      const createdName = newName.trim();
      await createMutation.mutateAsync({
        name: createdName,
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      });
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('OPERATOR');
      setStatusNotice(`User account "${createdName}" was successfully created.`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleOpenEdit = (userToEdit: UserSummary) => {
    setEditingUser(userToEdit);
    setEditName(userToEdit.name);
    setEditRole(userToEdit.role);
    setEditIsActive(userToEdit.isActive);
    setEditError(null);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || updateMutation.isPending) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Full name is required.');
      return;
    }

    if (editingUser.id === currentUser?.id && !editIsActive) {
      setEditError('You cannot deactivate your own administrative account.');
      return;
    }

    try {
      const updatedName = editName.trim();
      await updateMutation.mutateAsync({
        id: editingUser.id,
        payload: {
          name: updatedName,
          role: editRole,
          isActive: editIsActive,
        },
      });
      setEditingUser(null);
      setStatusNotice(`User account "${updatedName}" was successfully updated.`);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleToggleClick = (userToToggleStatus: UserSummary) => {
    if (userToToggleStatus.id === currentUser?.id && userToToggleStatus.isActive) {
      setStatusError('You cannot deactivate your own administrative account.');
      return;
    }
    setStatusError(null);
    setUserToToggle(userToToggleStatus);
  };

  const handleConfirmToggle = async () => {
    if (!userToToggle) return;
    setStatusError(null);
    try {
      const willBeActive = !userToToggle.isActive;
      await updateMutation.mutateAsync({
        id: userToToggle.id,
        payload: { isActive: willBeActive },
      });
      const actionWord = willBeActive ? 'activated' : 'deactivated';
      setStatusNotice(`User account "${userToToggle.name}" was successfully ${actionWord}.`);
      setUserToToggle(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update user status');
      setUserToToggle(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              User & Role Administration
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Manage organization users, administrative access credentials, and granular RBAC roles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          {canManageUsers && (
            <Button
              size="sm"
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </Button>
          )}
        </div>
      </div>

      {/* Status change feedback banners */}
      {statusNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-semibold p-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{statusError}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusError(null)}
            className="text-rose-600 hover:text-rose-800 font-semibold p-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ORG_ADMIN">Org Admin</option>
              <option value="IT_ADMIN">IT Admin</option>
              <option value="OPERATOR">Operator</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Users Loading Error"
          message={error instanceof Error ? error.message : 'Failed to load organization users.'}
          onRetry={() => refetch()}
        />
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No users found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No users matched your current filter criteria.'
              : 'There are no other administrative users configured for this organization.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                {canManageUsers && <th className="px-5 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 block">{u.name}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] text-blue-600 font-medium">You (Current Session)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-mono">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={getRoleBadgeVariant(u.role)} className="text-[11px] font-medium">
                      {u.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          u.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                    {formatDateTime(u.createdAt)}
                  </td>
                  {canManageUsers && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(u)}
                          className="h-7 text-[11px] px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100 gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleClick(u)}
                          disabled={u.id === currentUser?.id || updateMutation.isPending}
                          className="h-7 text-[11px] px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Organization User</h3>
              </div>
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="jane.doe@enterprise.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="OPERATOR">Operator (Standard fleet management)</option>
                  <option value="IT_ADMIN">IT Admin (Device and token management)</option>
                  <option value="ORG_ADMIN">Org Admin (Full organization control)</option>
                  <option value="SUPER_ADMIN">Super Admin (System Administrator)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createMutation.isPending}
                  onClick={() => setShowCreateModal(false)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal Dialog */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit User Account</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Assigned Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="OPERATOR">Operator (Standard fleet management)</option>
                  <option value="IT_ADMIN">IT Admin (Device and token management)</option>
                  <option value="ORG_ADMIN">Org Admin (Full organization control)</option>
                  <option value="SUPER_ADMIN">Super Admin (System Administrator)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  disabled={editingUser.id === currentUser?.id}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="editIsActive" className="text-xs font-medium text-slate-700">
                  Account Active (Enabled for login)
                </label>
              </div>
              {editingUser.id === currentUser?.id && (
                <p className="text-[11px] text-slate-400 italic">
                  You cannot deactivate your own active administrative session.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={() => setEditingUser(null)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  {updateMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Status Toggle Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(userToToggle)}
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) {
            setUserToToggle(null);
          }
        }}
        title={userToToggle?.isActive ? 'Deactivate User Account' : 'Activate User Account'}
        description={
          userToToggle
            ? userToToggle.isActive
              ? `Are you sure you want to deactivate account "${userToToggle.name}" (${userToToggle.email})? This user will immediately lose access to the platform until reactivated.`
              : `Are you sure you want to activate account "${userToToggle.name}" (${userToToggle.email})? This user will be granted login access according to their assigned role.`
            : ''
        }
        variant={userToToggle?.isActive ? 'danger' : 'warning'}
        confirmLabel={userToToggle?.isActive ? 'Deactivate User' : 'Activate User'}
        loading={updateMutation.isPending}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}
