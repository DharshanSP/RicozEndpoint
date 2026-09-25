import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Clock,
  Shield,
  FileCode,
  Save,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { getSettings, updateSettings, OrgSettings } from '../lib/api/settingsApi';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OrgSettings>({
    agentHeartbeatIntervalSeconds: 60,
    alertRetentionDays: 30,
    auditRetentionDays: 365,
    requireMfa: false,
    autoApproveCriticalPatches: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const res = await getSettings();
    if (res.success && res.data) {
      setSettings(res.data.settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    const res = await updateSettings(settings);
    if (res.success && res.data) {
      setSettings(res.data.settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      alert(res.error?.message || 'Failed to update organization settings');
    }
    setSaving(false);
  };

  const apiDocsUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '/docs')
    : 'http://localhost:3001/docs';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Organization Settings
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Global endpoint telemetry parameters, retention rules, security baselines, and developer API specs.
          </p>
        </div>

        {savedSuccess && (
          <Badge variant="success" className="py-1 px-3 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Settings Saved
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading settings...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Organization Profile Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Organization Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500">
                    Organization Name
                  </label>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {user?.organizationName || 'Ricoz Demo Organization'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500">
                    Organization Tenant ID
                  </label>
                  <p className="text-xs font-mono text-slate-600 mt-0.5">
                    {user?.organizationId || 'org-demo-uuid'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endpoint Agent Parameters */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Agent Telemetry & Heartbeat Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agent Heartbeat Interval (Seconds)
                </label>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={settings.agentHeartbeatIntervalSeconds}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      agentHeartbeatIntervalSeconds: parseInt(e.target.value) || 60,
                    }))
                  }
                  className="w-full max-w-xs px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Interval at which installed agents report online liveness and check for pending actions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alert Retention (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.alertRetentionDays}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        alertRetentionDays: parseInt(e.target.value) || 30,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Log Retention (Days)
                  </label>
                  <input
                    type="number"
                    min={30}
                    value={settings.auditRetentionDays}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        auditRetentionDays: parseInt(e.target.value) || 365,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Automation Settings */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Security & Automation Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Require Two-Factor Authentication (2FA)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Enforce TOTP / MFA authentication for administrative console logins.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireMfa}
                  onChange={(e) => setSettings((s) => ({ ...s, requireMfa: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Auto-Approve Critical OS Security Patches
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Automatically schedule deployment for critical vulnerability hotfixes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoApproveCriticalPatches}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, autoApproveCriticalPatches: e.target.checked }))
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Developer API & OpenAPI Documentation */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 py-3 flex flex-row items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                REST API & OpenAPI Specification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Interactive Swagger OpenAPI Documentation
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Explore available endpoints for devices, telemetry, software, commands, and audit logs.
                </p>
              </div>

              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
              >
                Open API Docs
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Organization Settings'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
