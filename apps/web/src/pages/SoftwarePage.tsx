import { useState, useEffect, useCallback } from 'react';
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
  History,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import {
  getSoftwareCatalog,
  deployApplication,
  getDeployments,
  SoftwareItem,
  DeploymentItem,
} from '../lib/api/softwareApi';
import { getDeviceGroups, DeviceGroup } from '../lib/api/deviceGroupsApi';
import { getDevices, Device } from '../lib/api/devicesApi';

const DEPLOY_STATUS_STYLES: Record<DeploymentItem['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SoftwarePage() {
  const { hasRole } = useAuth();
  const canDeploy = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);

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
  const [installerUrl, setInstallerUrl] = useState('');
  const [silentArgs, setSilentArgs] = useState('');

  // Feedback
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);

  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getSoftwareCatalog({ search });
    if (res.success && res.data) {
      setCatalog(res.data.items || []);
    } else {
      setError(res.error?.message || 'Failed to fetch software catalog');
    }
    setLoading(false);
  }, [search]);

  const fetchDeployments = useCallback(async () => {
    const res = await getDeployments({ limit: 8 });
    if (res.success && res.data) {
      setDeployments(res.data.items || []);
    }
  }, []);

  const fetchTargets = useCallback(async () => {
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
      const dList = Array.isArray(devRes.data) ? devRes.data : (devRes.data as { items?: Device[] }).items || [];
      setDevices(dList as Device[]);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
    fetchTargets();
    fetchDeployments();
  }, [fetchCatalog, fetchTargets, fetchDeployments]);

  const openDeployModal = (app: SoftwareItem | null) => {
    setSelectedApp(app);
    setInstallerUrl(app?.installerUrl ?? '');
    setSilentArgs('');
    setDeployAction('INSTALL');
    setBanner(null);
    setShowDeployModal(true);
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    const appName = selectedApp ? selectedApp.name : customAppName.trim();
    const appVersion = selectedApp ? selectedApp.latestVersion : '1.0.0';

    if (!appName || !targetId) {
      setBanner({ kind: 'error', text: 'Specify an application name and a deployment target.' });
      return;
    }

    setSubmitting(true);
    setBanner(null);

    const res = await deployApplication({
      name: appName,
      version: appVersion || '1.0.0',
      publisher: selectedApp?.publisher || 'Managed Admin',
      installerUrl: deployAction === 'INSTALL' ? installerUrl.trim() : undefined,
      silentArgs: deployAction === 'INSTALL' && silentArgs.trim() ? silentArgs.trim() : undefined,
      targetType,
      targetId,
      action: deployAction,
    });

    if (res.success && res.data) {
      const { queued, skippedInFlight, action } = res.data;
      const verb = action === 'INSTALL' ? 'installation' : 'uninstallation';
      setBanner({
        kind: 'success',
        text:
          queued > 0
            ? `Queued ${verb} of ${appName} on ${queued} device${queued === 1 ? '' : 's'}` +
              (skippedInFlight > 0 ? ` – ${skippedInFlight} already in flight` : '')
            : `Every target device already has a ${verb} of ${appName} in flight.`,
      });
      setShowDeployModal(false);
      setSelectedApp(null);
      setCustomAppName('');
      setInstallerUrl('');
      setSilentArgs('');
      fetchCatalog();
      fetchDeployments();
    } else {
      setBanner({ kind: 'error', text: res.error?.message || 'Failed to deploy application' });
    }
    setSubmitting(false);
  };

  const totalAppInstallations = catalog.reduce((acc, item) => acc + (item.deviceCount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Software Inventory & Deployments
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized software catalog discovered across fleet computers and remote application deployment engine.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCatalog}
            disabled={loading}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => openDeployModal(null)}
            disabled={!canDeploy}
            title={canDeploy ? undefined : 'Only IT administrators can deploy software'}
            className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>New Deployment</span>
          </Button>
        </div>
      </div>

      {/* Feedback banner */}
      {banner && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-xs ${
            banner.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {banner.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p className="flex-1">{banner.text}</p>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-current/60 hover:text-current"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                    onClick={() => openDeployModal(app)}
                    disabled={!canDeploy}
                    title={canDeploy ? undefined : 'Only IT administrators can deploy software'}
                    className="text-blue-600 hover:bg-blue-50 border-blue-200 text-xs px-2.5 py-1 disabled:opacity-50"
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

      {/* Recent deployments */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-base font-bold text-slate-900">Recent Deployments</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDeployments}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {deployments.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No deployment requests yet. Deploy an application to see its rollout status here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-3">Application</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Requested by</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.application.name}
                        <span className="ml-2 text-xs text-slate-400">v{row.application.version}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            row.action === 'INSTALL'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }
                        >
                          {row.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.device.deviceName}
                        <span className="ml-2 text-xs text-slate-400">{row.device.hostname}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.requester?.name ?? 'System'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatWhen(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`font-semibold ${DEPLOY_STATUS_STYLES[row.status]}`}
                          title={row.errorMessage ?? undefined}
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: New Deployment */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
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
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {deployAction === 'INSTALL'
                    ? 'The agent downloads the package and installs it silently on each target.'
                    : 'The agent matches the registered product name exactly and runs its uninstaller.'}
                </p>
              </div>

              {deployAction === 'INSTALL' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Installer URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://example.com/packages/setup.msi"
                      value={installerUrl}
                      onChange={(e) => setInstallerUrl(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Direct http(s) link to an .msi, .exe or .msu package.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Silent install arguments <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="/S /quiet"
                      value={silentArgs}
                      onChange={(e) => setSilentArgs(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product name <span className="text-red-500">*</span>
                  </label>
                  <p className="px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-800">
                    {selectedApp ? selectedApp.name : customAppName.trim() || '—'}
                  </p>
                </div>
              )}

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
