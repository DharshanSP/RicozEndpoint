import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plus, Copy, Check, Trash2, RefreshCw, X, CheckCircle2, History, Send, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import {
  useApproveEnrollmentTokenRequest,
  useCancelEnrollmentTokenRequest,
  useCreateEnrollmentToken,
  useCreateEnrollmentTokenRequest,
  useDenyEnrollmentTokenRequest,
  useEnrollmentHistory,
  useEnrollmentTokenList,
  useEnrollmentTokenRequests,
  useRevealEnrollmentTokenRequestToken,
  useRevokeEnrollmentToken,
} from '../hooks/useEnrollmentTokens';
import type { EnrollmentTokenRequestStatus, EnrollmentTokenSummary } from '../types/enrollment';
import { API_BASE_URL } from '../lib/api';
import { resolveAgentDownloadUrl } from '../lib/agent-download';

function statusBadge(token: EnrollmentTokenSummary): { label: string; variant: 'success' | 'warning' | 'secondary' } {
  if (!token.isActive) return { label: 'Revoked', variant: 'secondary' };
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    return { label: 'Expired', variant: 'warning' };
  }
  if (token.uses >= token.maxUses) return { label: 'Consumed', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
}

function requestStatusBadge(status: EnrollmentTokenRequestStatus): {
  label: string;
  variant: 'success' | 'warning' | 'secondary';
} {
  if (status === 'APPROVED') return { label: 'Approved', variant: 'success' };
  if (status === 'PENDING') return { label: 'Pending', variant: 'warning' };
  return { label: status === 'DENIED' ? 'Denied' : 'Cancelled', variant: 'secondary' };
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
  const { user, hasRole } = useAuth();
  const canManageTokens = hasRole(['SUPER_ADMIN', 'ORG_ADMIN', 'IT_ADMIN']);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<EnrollmentTokenSummary | null>(null);
  const [revokeNotice, setRevokeNotice] = useState<string | null>(null);

  const listQuery = useEnrollmentTokenList({ page: 1, limit: 50 }, canManageTokens);
  const requestsQuery = useEnrollmentTokenRequests({ page: 1, limit: 50 });
  const createMutation = useCreateEnrollmentToken();
  const createRequestMutation = useCreateEnrollmentTokenRequest();
  const approveMutation = useApproveEnrollmentTokenRequest();
  const denyMutation = useDenyEnrollmentTokenRequest();
  const cancelMutation = useCancelEnrollmentTokenRequest();
  const revealMutation = useRevealEnrollmentTokenRequestToken();
  const revokeMutation = useRevokeEnrollmentToken();
  const [showRequest, setShowRequest] = useState(false);
  const [requestLabel, setRequestLabel] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestMaxUses, setRequestMaxUses] = useState(1);
  const [requestExpiresAt, setRequestExpiresAt] = useState('');
  const [revealedRequestTokens, setRevealedRequestTokens] = useState<Record<string, string>>({});
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; action: 'approve' | 'deny' } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);

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

  const handleCreateRequest = () => {
    if (!requestNote.trim() || requestMaxUses < 1 || requestMaxUses > 1000) return;
    createRequestMutation.mutate(
      {
        label: requestLabel.trim() || undefined,
        requestNote: requestNote.trim(),
        maxUses: requestMaxUses,
        ...(requestExpiresAt ? { expiresAt: new Date(requestExpiresAt).toISOString() } : {}),
      },
      {
        onSuccess: () => {
          setRequestLabel('');
          setRequestNote('');
          setRequestMaxUses(1);
          setRequestExpiresAt('');
          setShowRequest(false);
        },
      }
    );
  };

  const openDecision = (id: string, action: 'approve' | 'deny') => {
    setDecisionTarget({ id, action });
    setDecisionNote('');
  };

  const handleDecisionConfirm = () => {
    if (!decisionTarget) return;
    if (decisionTarget.action === 'approve') {
      approveMutation.mutate(
        { id: decisionTarget.id, adminNote: decisionNote.trim() || undefined },
        { onSuccess: () => setDecisionTarget(null) }
      );
    } else {
      if (!decisionNote.trim()) return;
      denyMutation.mutate(
        { id: decisionTarget.id, adminNote: decisionNote.trim() },
        { onSuccess: () => setDecisionTarget(null) }
      );
    }
  };

  const handleRevealRequestToken = (id: string) => {
    revealMutation.mutate(id, {
      onSuccess: (issued) => {
        setRevealedRequestTokens((previous) => ({ ...previous, [id]: issued.token }));
      },
    });
  };

  const handleConfirmCancel = () => {
    if (!requestToCancel) return;
    cancelMutation.mutate(requestToCancel, { onSuccess: () => setRequestToCancel(null) });
  };

  // Same base the rest of the app talks to. Relying on a raw env read here would
  // fall back to localhost on deployed builds and hand operators a dead command.
  const apiUrl = API_BASE_URL;
  const windowsCommand = createdToken
    ? `$env:RICOZ_ENROLL_TOKEN='${createdToken.replace(/'/g, "''")}'; $env:RICOZ_API_URL='${apiUrl.replace(/'/g, "''")}'; iwr -useb '${apiUrl.replace(/'/g, "''")}/agent/install.ps1' | iex`
    : '';
  const handleCopyCommand = async () => {
    if (!windowsCommand) return;
    await navigator.clipboard.writeText(windowsCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  // Release asset for deployed builds; local dev uses the freshly built exe.
  const agentDownloadUrl = resolveAgentDownloadUrl(
    process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  );

  const handleDownloadAgentFile = () => {
    const link = document.createElement('a');
    link.href = agentDownloadUrl;
    // The `download` attribute only applies to same-origin URLs; harmless otherwise.
    link.download = 'RicozEndpointAgent.exe';
    link.rel = 'noopener';
    link.click();
  };

  const handleRevokeClick = (token: EnrollmentTokenSummary) => {
    if (!token.isActive) return;
    setTokenToRevoke(token);
  };

  const handleConfirmRevoke = () => {
    if (!tokenToRevoke) return;
    revokeMutation.mutate(tokenToRevoke.id, {
      onSuccess: () => {
        const tokenLabel = tokenToRevoke.label || tokenToRevoke.id.slice(0, 8);
        setRevokeNotice(`Enrollment token "${tokenLabel}" has been revoked.`);
        setTokenToRevoke(null);
      },
    });
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
            onClick={handleDownloadAgentFile}
            className="h-9 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download Agent</span>
          </Button>

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

          {canManageTokens ? (
            <Button
              size="sm"
              onClick={() => setShowCreate((value) => !value)}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showCreate ? 'Cancel' : 'Generate Token'}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowRequest((value) => !value)}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
            >
              {showRequest ? <X className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              <span>{showRequest ? 'Cancel' : 'Request Token'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Revoke feedback banner */}
      {revokeNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{revokeNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRevokeNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-semibold p-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Revoke error banner */}
      {revokeMutation.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-center justify-between shadow-xs">
          <span>Failed to revoke token: {(revokeMutation.error as Error).message}</span>
          <button
            type="button"
            onClick={() => revokeMutation.reset()}
            className="text-rose-600 hover:text-rose-800 font-semibold p-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Panel */}
      {showCreate && (
        <Card className="border-slate-200 bg-white shadow-xs animate-in fade-in duration-150">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Issue Enrollment Token</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Create a token, copy it, then run the agent on the target Windows device and enter the token when prompted.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {createdToken && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3 shadow-xs animate-in fade-in duration-200">
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
                <div className="space-y-2 pt-2 border-t border-emerald-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-900">Windows agent command</span>
                    <Button variant="outline" size="sm" onClick={handleCopyCommand} className="h-7 text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 gap-1">
                      {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCommand ? 'Copied!' : 'Copy command'}
                    </Button>
                  </div>
                  <code className="block text-xs text-slate-800 font-mono bg-white p-2.5 rounded-lg border border-emerald-200 break-all select-all">{windowsCommand}</code>
                  <p className="text-[11px] text-emerald-800">
                    Paste into an elevated PowerShell window on the target Windows machine. It downloads the agent,
                    stores the token machine-wide and starts the service — no Node.js required.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAgentFile}
                    className="w-full h-8 text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download RicozEndpoint Agent (.exe)
                  </Button>
                </div>
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
                <Input
                  placeholder="e.g. Finance Wing Windows rollout"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Max Device Enrollments</label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Expiration (Optional)</label>
                <Input
                  type="datetime-local"
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
      {!canManageTokens && showRequest && (
        <Card className="border-slate-200 bg-white shadow-xs animate-in fade-in duration-150">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Request Enrollment Token</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Operators and viewers can request a token. An administrator reviews the request and releases the token once.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {createRequestMutation.isError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                Failed to submit request: {(createRequestMutation.error as Error).message}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Token Label</label>
                <Input
                  placeholder="e.g. Field laptops"
                  value={requestLabel}
                  onChange={(event) => setRequestLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Max Device Enrollments</label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={requestMaxUses}
                  onChange={(event) => setRequestMaxUses(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Expiration (Optional)</label>
                <Input
                  type="datetime-local"
                  value={requestExpiresAt}
                  onChange={(event) => setRequestExpiresAt(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Why is this token needed?</label>
              <Textarea
                placeholder="e.g. Two replacement laptops need enrollment this week."
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRequest(false)}
                className="text-xs border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateRequest}
                disabled={createRequestMutation.isPending || !requestNote.trim() || requestMaxUses < 1 || requestMaxUses > 1000}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              {canManageTokens ? 'Token Requests' : 'My Token Requests'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {canManageTokens
                ? 'Review operator and viewer requests. Approved tokens are revealed exactly once.'
                : 'Track your requests. Approved tokens can be viewed and copied exactly once.'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
            className="h-7 text-xs border-slate-200 text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${requestsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {requestsQuery.isLoading && (
            <div className="p-6 space-y-3">
              {[0, 1].map((row) => (
                <div key={row} className="h-12 rounded-lg bg-slate-100 animate-pulse border border-slate-200" />
              ))}
            </div>
          )}
          {requestsQuery.isError && (
            <div className="p-6 text-xs text-rose-600">
              Failed to load token requests: {(requestsQuery.error as Error).message}
            </div>
          )}
          {requestsQuery.isSuccess && (requestsQuery.data?.data ?? []).length === 0 && (
            <div className="py-8 text-center p-6 text-xs text-slate-500">No token requests yet.</div>
          )}
          {requestsQuery.isSuccess && (requestsQuery.data?.data ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="px-5 py-3 font-semibold">Request</th>
                    <th className="px-5 py-3 font-semibold">Requested By</th>
                    <th className="px-5 py-3 font-semibold">Uses</th>
                    <th className="px-5 py-3 font-semibold">Expires</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(requestsQuery.data?.data ?? []).map((request) => {
                    const badge = requestStatusBadge(request.status);
                    const isOwn = request.requestedBy?.id === user?.id;
                    const revealedToken = revealedRequestTokens[request.id];
                    const canReveal =
                      request.status === 'APPROVED' && !request.tokenRevealed && (canManageTokens || isOwn);
                    return (
                      <tr key={request.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-slate-900 font-semibold block">{request.label || 'Untitled request'}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5 max-w-xs">{request.requestNote}</span>
                          {request.adminNote && (
                            <span className="text-[11px] text-slate-500 block mt-1">
                              Admin note: {request.adminNote}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {request.requestedBy?.name ?? request.requestedBy?.email ?? 'Unknown'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-mono font-medium">
                          0 / {request.maxUses}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                          {formatDate(request.expiresAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={badge.variant} className="text-[11px] font-medium">
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {request.status === 'PENDING' && canManageTokens && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDecision(request.id, 'approve')}
                                  className="h-7 text-[11px]"
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDecision(request.id, 'deny')}
                                  className="h-7 text-[11px] text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  Deny
                                </Button>
                              </>
                            )}
                            {request.status === 'PENDING' && isOwn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRequestToCancel(request.id)}
                                className="h-7 text-[11px] text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                              >
                                Cancel
                              </Button>
                            )}
                            {canReveal && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevealRequestToken(request.id)}
                                disabled={revealMutation.isPending}
                                className="h-7 text-[11px]"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> View token
                              </Button>
                            )}
                          </div>
                          {revealedToken && (
                            <div className="mt-2 flex items-center justify-end gap-1.5">
                              <code className="text-[11px] font-mono bg-emerald-50 border border-emerald-200 rounded px-2 py-1 break-all">
                                {revealedToken}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void navigator.clipboard.writeText(revealedToken)}
                                className="h-7 text-[11px]"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {request.status === 'APPROVED' && request.tokenRevealed && !revealedToken && (
                            <p className="mt-2 text-[11px] text-slate-500">Already revealed.</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {revealMutation.isError && (
            <p className="p-4 text-xs text-rose-600">Could not reveal that token: {(revealMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open && !approveMutation.isPending && !denyMutation.isPending) {
            setDecisionTarget(null);
          }
        }}
        title={decisionTarget?.action === 'deny' ? 'Deny Token Request' : 'Approve Token Request'}
        description={
          decisionTarget?.action === 'deny'
            ? 'The requester will see your explanatory note. Denied requests cannot be approved later.'
            : 'Approval makes the request eligible for a one-time token reveal. The raw token is never stored in the request list.'
        }
        icon={decisionTarget?.action === 'deny' ? Trash2 : CheckCircle2}
        variant={decisionTarget?.action === 'deny' ? 'danger' : 'warning'}
        confirmLabel={decisionTarget?.action === 'deny' ? 'Deny Request' : 'Approve Request'}
        loading={approveMutation.isPending || denyMutation.isPending}
        confirmDisabled={decisionTarget?.action === 'deny' && !decisionNote.trim()}
        onConfirm={handleDecisionConfirm}
      >
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            {decisionTarget?.action === 'deny' ? 'Denial reason (required)' : 'Admin note (optional)'}
          </label>
          <Textarea
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder={decisionTarget?.action === 'deny' ? 'Explain why this request cannot be approved.' : 'Optional context for the requester.'}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(requestToCancel)}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setRequestToCancel(null);
        }}
        title="Cancel Token Request"
        description="Cancelled requests cannot be approved later. You can submit a new request if needed."
        icon={X}
        variant="warning"
        confirmLabel="Cancel Request"
        loading={cancelMutation.isPending}
        onConfirm={handleConfirmCancel}
      />

      {/* List */}
      {canManageTokens && (
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
                            <Link
                              href={`/devices/${token.device.id}`}
                              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-mono block mt-0.5"
                            >
                              Pre-bound to {token.device.deviceName}
                            </Link>
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
                          {token.isActive && canManageTokens && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeClick(token)}
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
      )}

      {/* Revoke Token Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(tokenToRevoke)}
        onOpenChange={(open) => {
          if (!open && !revokeMutation.isPending) {
            setTokenToRevoke(null);
          }
        }}
        title="Revoke Enrollment Token"
        description={
          tokenToRevoke
            ? `Are you sure you want to revoke the enrollment token "${tokenToRevoke.label || tokenToRevoke.id.slice(0, 8)}"? This action cannot be undone and any pending or future agent enrollments with this token will be rejected.`
            : ''
        }
        icon={Trash2}
        variant="danger"
        confirmLabel="Revoke Token"
        loading={revokeMutation.isPending}
        onConfirm={handleConfirmRevoke}
      />

      {canManageTokens && <EnrollmentHistoryCard />}
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
                      <Link
                        href={`/devices/${entry.device.id}`}
                        className="text-slate-900 font-semibold hover:text-blue-600 hover:underline transition-colors block"
                      >
                        {entry.device.deviceName}
                      </Link>
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
