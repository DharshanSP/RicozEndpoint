import { useState, useEffect } from 'react';
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

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    const res = await getDeviceGroups({ search });
    if (res.success && res.data) {
      setGroups(res.data.items || []);
    } else {
      setError(res.error?.message || 'Failed to load device groups');
    }
    setLoading(false);
  };

  const fetchFleetDevices = async () => {
    const res = await getDevices({ limit: 100 });
    if (res.success && res.data) {
      const itemList = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
      setAllDevices(itemList);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchFleetDevices();
  }, [search]);

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
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    const res = await createDeviceGroup({
      name: newGroupName.trim(),
      description: newGroupDesc.trim(),
      deviceIds: selectedDeviceIds,
    });

    if (res.success) {
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedDeviceIds([]);
      fetchGroups();
    } else {
      alert(res.error?.message || 'Failed to create group');
    }
    setSubmitting(false);
  };

  const handleDeleteGroup = async (group: DeviceGroup) => {
    if (!confirm(`Are you sure you want to delete group "${group.name}"?`)) return;

    const res = await deleteDeviceGroup(group.id);
    if (res.success) {
      if (selectedGroup?.id === group.id) setSelectedGroup(null);
      fetchGroups();
    } else {
      alert(res.error?.message || 'Failed to delete group');
    }
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedDeviceIds.length === 0) return;

    setSubmitting(true);
    const res = await addDeviceGroupMembers(selectedGroup.id, selectedDeviceIds);
    if (res.success) {
      setShowAddMembersModal(false);
      setSelectedDeviceIds([]);
      loadDetail(selectedGroup.id);
      fetchGroups();
    } else {
      alert(res.error?.message || 'Failed to add members');
    }
    setSubmitting(false);
  };

  const handleRemoveMember = async (deviceId: string) => {
    if (!selectedGroup) return;

    const res = await removeDeviceGroupMember(selectedGroup.id, deviceId);
    if (res.success) {
      loadDetail(selectedGroup.id);
      fetchGroups();
    } else {
      alert(res.error?.message || 'Failed to remove member');
    }
  };

  const toggleDeviceSelection = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Device Groups</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Organize computers into logical groups for targeted policies, deployments, and compliance monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedDeviceIds([]);
              setShowCreateModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Main Layout: List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Group List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
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
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 space-y-3">
              <Layers className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No device groups found</p>
              <p className="text-xs text-slate-500">Create a group to organize endpoints by department or purpose.</p>
            </div>
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
                    onClick={() => handleDeleteGroup(selectedGroup)}
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
                              <p className="text-xs font-semibold text-slate-900">
                                {member.device?.deviceName || 'Unknown Device'}
                              </p>
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
                              onClick={() => member.device && handleRemoveMember(member.device.id)}
                              title="Remove device from group"
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                Create New Device Group
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance Workstations"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe group purpose or policy requirements..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !newGroupName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? 'Creating...' : 'Create Group'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Members */}
      {showAddMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Add Devices to {selectedGroup.name}
              </h3>
              <button
                onClick={() => setShowAddMembersModal(false)}
                className="text-slate-400 hover:text-slate-600"
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
                onClick={() => setShowAddMembersModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddMembers}
                disabled={submitting || selectedDeviceIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? 'Adding...' : `Add Selected (${selectedDeviceIds.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
