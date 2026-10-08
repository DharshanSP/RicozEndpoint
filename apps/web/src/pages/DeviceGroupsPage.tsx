import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Search,
  ShieldCheck,
  Trash2,
  RefreshCw,
  FolderPlus,
  Laptop,
  X,
  UserPlus,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { AlertBanner } from '../components/ui/AlertBanner';
import { EmptyState } from '../components/ui/EmptyState';
import {
  getDeviceGroups,
  getDeviceGroupDetail,
  createDeviceGroup,
  deleteDeviceGroup,
  addDeviceGroupMembers,
  removeDeviceGroupMember,
  DeviceGroup,
} from '../lib/api/deviceGroupsApi';
import { getDevices, Device } from '../lib/api/devicesApi';

export function DeviceGroupsPage() {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<DeviceGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getDeviceGroups({ search });
    if (res.success && res.data) {
      setGroups(res.data.items || []);
    } else {
      setError(res.error?.message || 'Failed to load device groups');
    }
    setLoading(false);
  }, [search]);

  const fetchFleetDevices = useCallback(async () => {
    const res = await getDevices({ limit: 100 });
    if (res.success && res.data) {
      const itemList = Array.isArray(res.data) ? res.data : (res.data as { items?: Device[] }).items || [];
      setAllDevices(itemList as Device[]);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchFleetDevices();
  }, [fetchGroups, fetchFleetDevices]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await getDeviceGroupDetail(id);
    if (res.success && res.data) {
      setSelectedGroup(res.data);
    }
    setDetailLoading(false);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || submitting) return;

    setSubmitting(true);
    setActionError(null);
    const res = await createDeviceGroup({
      name: newGroupName.trim(),
      description: newGroupDesc.trim(),
      deviceIds: selectedDeviceIds,
    });

    if (res.success) {
      const createdName = newGroupName.trim();
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedDeviceIds([]);
      setActionSuccess(`Device group "${createdName}" was successfully created.`);
      await fetchGroups();
    } else {
      setActionError(res.error?.message || 'Failed to create group');
    }
    setSubmitting(false);
  };

  const handleDeleteClick = (group: DeviceGroup) => {
    setActionError(null);
    setGroupToDelete(group);
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    setDeleteLoading(true);
    setActionError(null);
    const res = await deleteDeviceGroup(groupToDelete.id);
    if (res.success) {
      const deletedName = groupToDelete.name;
      if (selectedGroup?.id === groupToDelete.id) setSelectedGroup(null);
      setActionSuccess(`Device group "${deletedName}" was successfully deleted.`);
      setGroupToDelete(null);
      await fetchGroups();
    } else {
      setActionError(res.error?.message || 'Failed to delete group');
      setGroupToDelete(null);
    }
    setDeleteLoading(false);
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedDeviceIds.length === 0 || submitting) return;

    setSubmitting(true);
    setActionError(null);
    const count = selectedDeviceIds.length;
    const groupName = selectedGroup.name;
    const res = await addDeviceGroupMembers(selectedGroup.id, selectedDeviceIds);
    if (res.success) {
      setShowAddMembersModal(false);
      setSelectedDeviceIds([]);
      setActionSuccess(`Successfully added ${count} device${count === 1 ? '' : 's'} to group "${groupName}".`);
      await loadDetail(selectedGroup.id);
      await fetchGroups();
    } else {
      setActionError(res.error?.message || 'Failed to add members');
    }
    setSubmitting(false);
  };

  const handleRemoveMember = async (deviceId: string, deviceName?: string) => {
    if (!selectedGroup || removingDeviceId) return;

    setRemovingDeviceId(deviceId);
    setActionError(null);
    const targetName = deviceName || 'Device';
    const groupName = selectedGroup.name;
    const res = await removeDeviceGroupMember(selectedGroup.id, deviceId);
    if (res.success) {
      setActionSuccess(`Successfully removed "${targetName}" from group "${groupName}".`);
      await loadDetail(selectedGroup.id);
      await fetchGroups();
    } else {
      setActionError(res.error?.message || 'Failed to remove member');
    }
    setRemovingDeviceId(null);
  };

  const toggleDeviceSelection = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        icon={Layers}
        title="Device Groups"
        description="Organize computers into logical groups for targeted policies, deployments, and compliance monitoring."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGroups}
              disabled={loading}
              className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedDeviceIds([]);
                setShowCreateModal(true);
              }}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create Group</span>
            </Button>
          </div>
        }
      />

      {/* Action success banner */}
      {actionSuccess && (
        <AlertBanner
          variant="success"
          message={actionSuccess}
          dismissible
          onDismiss={() => setActionSuccess(null)}
        />
      )}

      {/* Action error banner */}
      {actionError && (
        <AlertBanner
          variant="error"
          message={actionError}
          dismissible
          onDismiss={() => setActionError(null)}
        />
      )}

      {/* Main Layout: List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Group List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading groups...
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
              {error}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No device groups found"
              description="Create a group to organize endpoints by department or purpose."
              compact
            />
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <div
                    key={group.id}
                    onClick={() => loadDetail(group.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {group.description || 'No description provided.'}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 ${isSelected ? 'text-blue-600' : ''}`} />
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-slate-400" />
                        <span>{group.membersCount} devices</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{group.policiesCount} policies</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Group Detail */}
        <div className="lg:col-span-2">
          {detailLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                Loading group details...
              </CardContent>
            </Card>
          ) : selectedGroup ? (
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {selectedGroup.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-normal">
                      ID: {selectedGroup.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedGroup.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDeviceIds([]);
                      setShowAddMembersModal(true);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1.5 text-blue-600" />
                    Add Devices
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(selectedGroup)}
                    disabled={deleteLoading}
                    className="text-red-600 hover:bg-red-50 hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Group Members List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-blue-600" />
                      Member Devices ({selectedGroup.members?.length || 0})
                    </h4>
                  </div>

                  {!selectedGroup.members || selectedGroup.members.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No devices currently assigned to this group.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                      {selectedGroup.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-slate-100 text-slate-600">
                              <Laptop className="w-4 h-4" />
                            </div>
                            <div>
                              {member.device ? (
                                <Link
                                  to={`/devices/${member.device.id}`}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors block"
                                >
                                  {member.device.deviceName || 'Unknown Device'}
                                </Link>
                              ) : (
                                <p className="text-xs font-semibold text-slate-900">
                                  Unknown Device
                                </p>
                              )}
                              <p className="text-[11px] text-slate-500 font-mono">
                                Host: {member.device?.hostname || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge
                              variant={member.device?.status === 'ONLINE' ? 'success' : 'secondary'}
                              className="text-[10px]"
                            >
                              {member.device?.status || 'UNKNOWN'}
                            </Badge>

                            <button
                              onClick={() => member.device && handleRemoveMember(member.device.id, member.device.deviceName)}
                              disabled={Boolean(removingDeviceId)}
                              title="Remove device from group"
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {removingDeviceId === member.device?.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assigned Policies */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Assigned Group Policies ({selectedGroup.assignments?.length || 0})
                  </h4>

                  {!selectedGroup.assignments || selectedGroup.assignments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No security policies explicitly assigned to this group.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedGroup.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-slate-900">
                              {assignment.policy?.name || 'Policy'}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-white">
                            Priority: {assignment.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="p-12 text-center text-slate-500 space-y-2">
                <Layers className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-700">Select a device group</p>
                <p className="text-xs text-slate-500">
                  Click any group on the left panel to inspect member endpoints and policy assignments.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Create Group */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                Create New Device Group
              </h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Group Name *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Finance Workstations"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <Textarea
                  rows={2}
                  placeholder="Describe group purpose or policy requirements..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Devices ({selectedDeviceIds.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 p-1">
                  {allDevices.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      No devices available in inventory.
                    </div>
                  ) : (
                    allDevices.map((dev) => {
                      const checked = selectedDeviceIds.includes(dev.id);
                      return (
                        <div
                          key={dev.id}
                          onClick={() => toggleDeviceSelection(dev.id)}
                          className={`p-2 rounded-md flex items-center justify-between text-xs cursor-pointer ${
                            checked ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>{dev.deviceName} ({dev.hostname})</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {dev.os}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !newGroupName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Group</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Members */}
      {showAddMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Add Devices to {selectedGroup.name}
              </h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowAddMembersModal(false)}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Select fleet devices to add to this group:
              </p>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 p-1">
                {allDevices.map((dev) => {
                  const alreadyMember = selectedGroup.members?.some(
                    (m) => m.device?.id === dev.id
                  );
                  const checked = selectedDeviceIds.includes(dev.id);

                  if (alreadyMember) return null;

                  return (
                    <div
                      key={dev.id}
                      onClick={() => toggleDeviceSelection(dev.id)}
                      className={`p-2 rounded-md flex items-center justify-between text-xs cursor-pointer ${
                        checked ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{dev.deviceName} ({dev.hostname})</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {dev.os}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setShowAddMembersModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddMembers}
                disabled={submitting || selectedDeviceIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Add Selected ({selectedDeviceIds.length})</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(groupToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setGroupToDelete(null);
          }
        }}
        title="Delete Device Group"
        description={
          groupToDelete
            ? `Are you sure you want to delete group "${groupToDelete.name}"? Group member devices will not be deleted, but all group policy associations and assignments will be removed.`
            : ''
        }
        icon={Trash2}
        variant="danger"
        confirmLabel="Delete Group"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
