import { useState } from 'react';
import { KeyRound, Plus, Copy, Check, Trash2, RefreshCw, X, CheckCircle2, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  useCreateEnrollmentToken,
  useEnrollmentHistory,
  useEnrollmentTokenList,
  useRevokeEnrollmentToken,
} from '../hooks/useEnrollmentTokens';
import type { EnrollmentTokenSummary } from '../types/enrollment';

const inputClass =
  'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors';

function statusBadge(token: EnrollmentTokenSummary): { label: string; variant: 'success' | 'warning' | 'secondary' } {
  if (!token.isActive) return { label: 'Revoked', variant: 'secondary' };
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    return { label: 'Expired', variant: 'warning' };
  }
  if (token.uses >= token.maxUses) return { label: 'Consumed', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
}

function formatDate(value: string | null, fallback = 'Never'): string {
  if (!value) return fallback;
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EnrollmentTokensPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const listQuery = useEnrollmentTokenList({ page: 1, limit: 50 });
  const createMutation = useCreateEnrollmentToken();
  const revokeMutation = useRevokeEnrollmentToken();

  const tokens = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  const activeCount = tokens.filter(
    (t) =>
      t.isActive &&
      (!t.expiresAt || new Date(t.expiresAt).getTime() >= Date.now()) &&
      t.uses < t.maxUses,
  ).length;

  const handleCreate = () => {
    if (maxUses < 1 || maxUses > 1000) return;
    createMutation.mutate(
      {
        label: label.trim() || undefined,
        maxUses,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      },
      {
        onSuccess: (result) => {
          setCreatedToken(result.token);
          setLabel('');
          setMaxUses(1);
          setExpiresAt('');
        },
      },
    );
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (token: EnrollmentTokenSummary) => {
    if (!token.isActive) return;
    if (!window.confirm(`Revoke enrollment token '${token.label || token.id.slice(0, 8)}'?`)) return;
    revokeMutation.mutate(token.id);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Enrollment Tokens
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Issue single-use or scoped tokens that endpoint agents exchange for per-device credentials during initial discovery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
            <span>{listQuery.isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreate((value) => !value)}
            className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
          >
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreate ? 'Cancel' : 'Generate Token'}</span>
          </Button>
        </div>
      </div>

      {/* Create Panel */}
      {showCreate && (
        <Card className="border-slate-200 bg-white shadow-xs animate-in fade-in duration-150">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Issue Enrollment Token</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              The secret token will be shown only once upon creation. Copy and configure it on the target host as <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded border border-blue-200">ENROLLMENT_TOKEN</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {createdToken && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Generated Enrollment Token (Copy Now)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </Button>
                </div>
                <code className="block text-xs text-emerald-950 font-mono bg-white p-2.5 rounded-lg border border-emerald-200 break-all font-semibold select-all">
                  {createdToken}
                </code>
              </div>
            )}

            {createMutation.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                Failed to create token: {(createMutation.error as Error).message}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Token Label</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Finance Wing Windows rollout"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Max Device Enrollments</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className={inputClass}
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Expiration (Optional)</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="text-xs border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createMutation.isPending || maxUses < 1 || maxUses > 1000}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createMutation.isPending ? 'Generating...' : 'Confirm & Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Active & Historical Tokens</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Tokens are automatically tracked and marked consumed once usage limits are met.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-medium">
            {activeCount} active / {total} total
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading && (
            <div className="p-6 space-y-3" data-testid="enrollment-tokens-loading">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 rounded-lg bg-slate-100 animate-pulse border border-slate-200" />
              ))}
            </div>
          )}

          {listQuery.isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center p-6">
              <p className="text-xs text-rose-600">{(listQuery.error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {listQuery.isSuccess && tokens.length === 0 && (
            <div className="py-12 text-center p-6 space-y-2">
              <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500 mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No enrollment tokens issued yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Generate an enrollment token to onboard physical and virtual devices to your fleet.
              </p>
            </div>
          )}

          {listQuery.isSuccess && tokens.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="px-5 py-3 font-semibold">Label</th>
                    <th className="px-5 py-3 font-semibold">Uses</th>
                    <th className="px-5 py-3 font-semibold">Expires</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Last Used / Created</th>
                    <th className="px-5 py-3 font-semibold">Created By</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tokens.map((token) => {
                    const badge = statusBadge(token);
                    return (
                      <tr key={token.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-slate-900 font-semibold block">{token.label || 'Untitled Token'}</span>
                          {token.device && (
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              Pre-bound to {token.device.deviceName}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-mono font-medium">
                          {token.uses} / {token.maxUses}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                          {formatDate(token.expiresAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={badge.variant} className="text-[11px] font-medium">
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-700 font-mono text-[11px]">
                            {token.lastUsedAt ? `Used ${formatDate(token.lastUsedAt)}` : 'Never used'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Created {formatDate(token.createdAt)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {token.createdBy?.name ?? token.createdBy?.email ?? 'System'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {token.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(token)}
                              disabled={revokeMutation.isPending}
                              className="h-7 text-[11px] text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EnrollmentHistoryCard />
    </div>
  );
}

/**
 * Enrollment history derived from issued agent tokens. A device that re-enrolls
 * receives a new agent token, so a repeated serial number here is expected and
 * means a re-enrollment occurred.
 */
function EnrollmentHistoryCard() {
  const historyQuery = useEnrollmentHistory(25);
  const entries = historyQuery.data ?? [];

  return (
    <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base font-bold text-slate-900">Enrollment History</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Every agent credential ever issued. Repeated devices indicate re-enrollment.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {historyQuery.isLoading && (
          <div className="p-6 space-y-3">
            {[0, 1].map((row) => (
              <div key={row} className="h-10 rounded-lg bg-slate-100 animate-pulse border border-slate-200" />
            ))}
          </div>
        )}

        {historyQuery.isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center p-6">
            <p className="text-xs text-rose-600">
              {(historyQuery.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void historyQuery.refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        )}

        {historyQuery.isSuccess && entries.length === 0 && (
          <div className="py-8 text-center p-6 space-y-2">
            <History className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">No devices have enrolled yet.</p>
          </div>
        )}

        {historyQuery.isSuccess && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">Serial</th>
                  <th className="px-5 py-3 font-semibold">OS</th>
                  <th className="px-5 py-3 font-semibold">Enrolled</th>
                  <th className="px-5 py-3 font-semibold text-right">Credential</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-slate-900 font-semibold">
                        {entry.device.deviceName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {entry.device.hostname}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-mono text-xs">
                      {entry.device.serialNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {entry.device.os} {entry.device.osVersion}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {formatDate(entry.enrolledAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge
                        variant={entry.isCurrent ? 'success' : 'secondary'}
                        className="text-[11px] font-medium"
                      >
                        {entry.isCurrent ? 'Current' : 'Revoked'}
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
  );
}