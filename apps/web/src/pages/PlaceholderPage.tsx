import type { FC } from 'react';
import { LucideIcon, ArrowLeft, Clock, ShieldCheck, Database, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export interface PlaceholderPageProps {
  title: string;
  section: string;
  description: string;
  icon: LucideIcon;
  milestone?: string;
  schemaEntities?: string[];
  plannedFeatures?: string[];
}

export const PlaceholderPage: FC<PlaceholderPageProps> = ({
  title,
  section,
  description,
  icon: Icon,
  milestone = 'Planned in Agent & Telemetry Pipeline',
  schemaEntities = [],
  plannedFeatures = [],
}) => {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>{section}</span>
            <span>/</span>
            <span className="text-slate-200">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">{title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-slate-900 border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Planned Module</span>
          </Badge>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-300">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Module Overview Banner */}
      <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Architecture Pipeline</span>
              </div>
              <h3 className="text-base font-semibold text-slate-200">
                {title} module interface is staged for telemetry ingestion
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The database schema and architectural contracts for this module are established in the core engine.
                Full interactive telemetry, configuration controls, and administrative actions will activate with the corresponding agent services.
              </p>
            </div>
            <div className="shrink-0 p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-right space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Target Milestone</span>
              <span className="text-xs font-medium text-slate-300 block">{milestone}</span>
              <span className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Data Model Ready
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Planned Capabilities */}
        {plannedFeatures.length > 0 && (
          <Card className="border-slate-800/80 bg-slate-900/40">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <CardTitle className="text-sm font-semibold text-slate-200">Planned Module Capabilities</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Core features designed for this management domain
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <ul className="space-y-2.5">
                {plannedFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Database Schema Entities */}
        {schemaEntities.length > 0 && (
          <Card className="border-slate-800/80 bg-slate-900/40">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <CardTitle className="text-sm font-semibold text-slate-200">Underlying Database Schema Models</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Prisma models established for this module in PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="flex flex-wrap gap-2">
                {schemaEntities.map((entity, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {entity}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
