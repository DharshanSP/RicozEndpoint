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
  KeyRound,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { getSettings, updateSettings, OrgSettings } from '../lib/api/settingsApi';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user, hasRole } = useAuth();
  // Mirrors the API: organization settings may only be written by ORG_ADMIN+.
  const canManage = hasRole(['SUPER_ADMIN', 'ORG_ADMIN']);
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setLoadError(null);
    const res = await getSettings();
    if (res.success && res.data) {
      setSettings(res.data.settings);
    } else {
      setLoadError(res.error?.message ?? 'Failed to load organization settings.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    const res = await updateSettings(settings);
    if (res.success && res.data) {
      setSettings(res.data.settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setSaveError(res.error?.message || 'Failed to update organization settings');
    }
    setSaving(false);
  };

  const apiDocsUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '/docs')
    : 'http://localhost:3001/docs';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Organization Settings
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Global endpoint telemetry parameters, retention rules, security baselines, and developer API specs.
            </p>
          </div>
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
          {loadError && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchSettings()}>
                Retry
              </Button>
            </div>
          )}

          {!canManage && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              You have read-only access to organization settings. Ask an ORG_ADMIN or SUPER_ADMIN to make changes.
            </div>
          )}
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
                <div className="max-w-xs">
                  <Input
                    type="number"
                    min={10}
                    max={3600}
                    disabled={!canManage}
                    value={settings.agentHeartbeatIntervalSeconds}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        agentHeartbeatIntervalSeconds: parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Interval at which installed agents report online liveness and check for pending actions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alert Retention (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    disabled={!canManage}
                    value={settings.alertRetentionDays}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        alertRetentionDays: parseInt(e.target.value) || 30,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Log Retention (Days)
                  </label>
                  <Input
                    type="number"
                    min={30}
                    disabled={!canManage}
                    value={settings.auditRetentionDays}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        auditRetentionDays: parseInt(e.target.value) || 365,
                      }))
                    }
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
                  disabled={!canManage}
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
                  disabled={!canManage}
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
          {saveError && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div>
          )}
          <div className="flex items-center justify-end gap-3">
            {!canManage && <span className="text-xs text-slate-500">Editing disabled for your role</span>}
            <Button
              type="submit"
              disabled={saving || !canManage}
              className="h-9 text-xs px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving...' : 'Save Organization Settings'}
            </Button>
          </div>
        </form>
      )}

      <PasswordSection />
    </div>
  );
}

/**
 * Self-service password management. Visible to every signed-in user because
 * changing your own password is not an administrative action.
 */
function PasswordSection() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && !mismatch && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setFeedback(null);

    const res = await changePassword(currentPassword, newPassword);

    if (res.success) {
      setFeedback({ tone: 'ok', text: 'Password updated. Your session stays active.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setFeedback({ tone: 'error', text: res.message ?? 'Failed to change password.' });
    }
    setSubmitting(false);
  };

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="w-4 h-4 text-blue-600" />
          Change Password
        </CardTitle>
        <p className="text-xs text-slate-500">
          Signed in as {user?.email}. You will stay signed in after the change.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <PasswordInput
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-9"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <PasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-9"
            />
            {tooShort && (
              <p className="text-[11px] text-rose-600 mt-1">Use at least 8 characters.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <PasswordInput
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-9"
            />
            {mismatch && (
              <p className="text-[11px] text-rose-600 mt-1">Passwords do not match.</p>
            )}
          </div>

          {feedback && (
            <div
              className={`rounded-md border p-2.5 text-xs ${
                feedback.tone === 'ok'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-rose-300 bg-rose-50 text-rose-700'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-9 text-xs px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold"
          >
            {submitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
