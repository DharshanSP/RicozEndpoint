import { useState } from 'react';
import { KeyRound, Plus, Copy, Check, Trash2, RefreshCw, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useCreateEnrollmentToken, useEnrollmentTokenList, useRevokeEnrollmentToken } from '../hooks/useEnrollmentTokens';
import type { EnrollmentTokenSummary } from '../types/enrollment';

const inputClass =
  'w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50';

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
    if (!window.confirm(`Revoke enrollment token ${token.label || token.id.slice(0, 8)}?`)) return;
    revokeMutation.mutate(token.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            Enrollment Tokens
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Issue single-use codes that endpoint agents exchange for per-device credentials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listQuery.isFetching && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
          <Button variant="default" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {showCreate ? 'Cancel' : 'New Token'}
          </Button>
        </div>
      </div>

      {/* Create Panel */}
      {showCreate && (
        <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white">Issue Enrollment Token</CardTitle>
            <CardDescription>
              The code is shown only once. Configure the agent's <code className="text-blue-400">ENROLLMENT_TOKEN</code> and start it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {createdToken && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Enrollment code (copy now)
                  </span>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <code className="block text-sm text-emerald-300 break-all font-mono">{createdToken}</code>
              </div>
            )}

            {createMutation.isError && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                Failed to create token: {(createMutation.error as Error).message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Label</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Finance floor rollout"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Max uses</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className={inputClass}
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Expires at</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || maxUses < 1 || maxUses > 1000}
              >
                {createMutation.isPending ? 'Creating...' : 'Generate Token'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base">Issued Tokens</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {activeCount} active / {total} total
            </Badge>
          </div>
          <CardDescription>Single-use codes are consumed automatically after enrollment.</CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && (
            <div className="space-y-3" data-testid="enrollment-tokens-loading">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 rounded-md bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}

          {listQuery.isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="text-sm text-rose-300">{(listQuery.error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {listQuery.isSuccess && tokens.length === 0 && (
            <div className="py-10 text-center">
              <KeyRound className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No enrollment tokens issued yet.</p>
            </div>
          )}

          {listQuery.isSuccess && tokens.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/70 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-4 font-semibold">Label</th>
                    <th className="pb-2 pr-4 font-semibold">Uses</th>
                    <th className="pb-2 pr-4 font-semibold">Expires</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                    <th className="pb-2 pr-4 font-semibold">Created</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const badge = statusBadge(token);
                    return (
                      <tr key={token.id} className="border-b border-slate-800/70">
                        <td className="py-2.5 pr-4">
                          <div className="text-slate-100 font-medium">{token.label || 'Untitled'}</div>
                          {token.device && (
                            <div className="text-xs text-slate-500">
                              Bound to {token.device.deviceName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-300">
                          {token.uses} / {token.maxUses}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-300">{formatDate(token.expiresAt)}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-400">{formatDate(token.createdAt)}</td>
                        <td className="py-2.5 text-right">
                          {token.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(token)}
                              disabled={revokeMutation.isPending}
                              className="text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
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
    </div>
  );
}