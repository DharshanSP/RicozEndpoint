import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Send,
  Layers,
  Laptop,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  getSoftwareCatalog,
  deployApplication,
  SoftwareItem,
} from '../lib/api/softwareApi';
import { getDeviceGroups, DeviceGroup } from '../lib/api/deviceGroupsApi';
import { getDevices, Device } from '../lib/api/devicesApi';

export function SoftwarePage() {
  const [catalog, setCatalog] = useState<SoftwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Deployment modal state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SoftwareItem | null>(null);
  const [customAppName, setCustomAppName] = useState('');
  const [targetType, setTargetType] = useState<'GROUP' | 'DEVICE'>('GROUP');
  const [targetId, setTargetId] = useState('');
  const [deployAction, setDeployAction] = useState<'INSTALL' | 'UNINSTALL'>('INSTALL');

  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    const res = await getSoftwareCatalog({ search });
    if (res.success && res.data) {
      setCatalog(res.data.items || []);
    } else {
      setError(res.error?.message || 'Failed to fetch software catalog');
    }
    setLoading(false);
  };

  const fetchTargets = async () => {
    const [groupsRes, devRes] = await Promise.all([
      getDeviceGroups({ limit: 100 }),
      getDevices({ limit: 100 }),
    ]);

    if (groupsRes.success && groupsRes.data) {
      const gList = groupsRes.data.items || [];
      setGroups(gList);
      if (gList.length > 0 && gList[0]) setTargetId(gList[0].id);
    }
    if (devRes.success && devRes.data) {
      const dList = Array.isArray(devRes.data) ? devRes.data : (devRes.data as any).items || [];
      setDevices(dList);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchTargets();
  }, [search]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    const appName = selectedApp ? selectedApp.name : customAppName.trim();
    const appVersion = selectedApp ? selectedApp.latestVersion : '1.0.0';

    if (!appName || !targetId) {
      alert('Please specify an application name and target');
      return;
    }

    setSubmitting(true);
    const res = await deployApplication({
      name: appName,
      version: appVersion,
      publisher: selectedApp?.publisher || 'Managed Admin',
      targetType,
      targetId,
      action: deployAction,
    });

    if (res.success) {
      alert(`Deployment created successfully! Status: ${res.data?.status}`);
      setShowDeployModal(false);
      setSelectedApp(null);
      setCustomAppName('');
      fetchCatalog();
    } else {
      alert(res.error?.message || 'Failed to deploy application');
    }
    setSubmitting(false);
  };

  const totalAppInstallations = catalog.reduce((acc, item) => acc + (item.deviceCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Software Inventory & Deployments
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centralized software catalog discovered across fleet computers and remote application deployment engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchCatalog} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Catalog
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedApp(null);
              setShowDeployModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Catalog Titles
              </p>
              <h3 className="text-xl font-bold text-slate-900">{catalog.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Installations
              </p>
              <h3 className="text-xl font-bold text-slate-900">{totalAppInstallations}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Deployment Mode
              </p>
              <h3 className="text-xl font-bold text-slate-900">Automated Silent</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search application by name or publisher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* Software Catalog Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Querying software inventory telemetry...
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
          {error}
        </div>
      ) : catalog.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 space-y-3">
          <Package className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No software items found</p>
          <p className="text-xs text-slate-500">
            Enrolled Windows endpoints automatically report installed application telemetry on heartbeat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalog.map((app) => (
            <Card key={app.name} className="border-slate-200 bg-white hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-start justify-between">
                <div className="min-w-0 pr-2">
                  <CardTitle className="text-base font-bold text-slate-900 truncate">
                    {app.name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Publisher: {app.publisher || 'Unknown'}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                  {app.deviceCount} machines
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Version Distribution
                  </p>
                  <div className="space-y-1">
                    {(app.versions || []).slice(0, 3).map((v) => (
                      <div key={v.version} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-700">v{v.version}</span>
                        <span className="text-slate-500">{v.count} devices</span>
                      </div>
                    ))}
                    {(app.versions || []).length > 3 && (
                      <p className="text-[10px] text-slate-400">
                        +{(app.versions || []).length - 3} additional versions
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-500">Latest seen: </span>
                    <span className="font-semibold text-slate-800">v{app.latestVersion}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedApp(app);
                      setShowDeployModal(true);
                    }}
                    className="text-blue-600 hover:bg-blue-50 border-blue-200 text-xs px-2.5 py-1"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Deploy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: New Deployment */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Deploy Software Package
              </h3>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeploy} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Application Name
                </label>
                {selectedApp ? (
                  <input
                    type="text"
                    disabled
                    value={`${selectedApp.name} (v${selectedApp.latestVersion})`}
                    className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-800"
                  />
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google Chrome, VS Code"
                    value={customAppName}
                    onChange={(e) => setCustomAppName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeployAction('INSTALL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      deployAction === 'INSTALL'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Install Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeployAction('UNINSTALL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      deployAction === 'UNINSTALL'
                        ? 'bg-red-50 border-red-300 text-red-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Uninstall Application
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deployment Target Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('GROUP');
                      if (groups.length > 0 && groups[0]) setTargetId(groups[0].id);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
                      targetType === 'GROUP'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Device Group
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('DEVICE');
                      if (devices.length > 0 && devices[0]) setTargetId(devices[0].id);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
                      targetType === 'DEVICE'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Laptop className="w-4 h-4" />
                    Single Machine
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Target {targetType === 'GROUP' ? 'Group' : 'Machine'}
                </label>
                {targetType === 'GROUP' ? (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.membersCount} devices)
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deviceName} ({d.hostname})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeployModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? 'Deploying...' : 'Confirm & Deploy'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
