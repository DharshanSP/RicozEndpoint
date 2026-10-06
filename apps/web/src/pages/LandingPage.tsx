import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Laptop,
  Server,
  KeyRound,
  Layers,
  ShieldCheck,
  Wrench,
  CheckSquare,
  Bell,
  BarChart3,
  History,
  ArrowRight,
  CheckCircle2,
  Activity,
  ChevronRight,
  Menu,
  X,
  Lock,
  Users,
  MapPin,
  Phone,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white uppercase tracking-wider">
              Release
            </span>
            <span className="text-slate-300 font-medium">
              RicozEndpoint Enterprise v0.1.0 is live — Automated Policy Baselines & Patch Orchestration
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              Orchestrator Operational
            </span>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="hover:text-white transition-colors text-xs font-semibold text-blue-400"
            >
              {isAuthenticated ? 'Go to Console →' : 'Admin Login →'}
            </Link>
          </div>
        </div>
      </div>

      {/* 2. STICKY HEADER NAVIGATION */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  Ricoz<span className="text-blue-600">Endpoint</span>
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-blue-200 text-blue-700 bg-blue-50">
                  Enterprise
                </Badge>
              </div>
              <span className="text-[10px] text-slate-500 font-medium -mt-1 hidden sm:block">
                Unified Endpoint Management
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#tutorial" className="hover:text-blue-600 transition-colors">
              Getting Started
            </a>
            <a href="#architecture" className="hover:text-blue-600 transition-colors">
              Architecture
            </a>
          </nav>

          {/* Header Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg gap-2 h-9 px-4 shadow-xs">
                  <span>Open Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg gap-2 h-9 px-4 shadow-xs">
                  <Lock className="w-4 h-4" />
                  <span>Launch Console / Sign In</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-2">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            >
              How It Works
            </a>
            <a
              href="#tutorial"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            >
              Getting Started Tutorial
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
            >
              System Architecture
            </a>
            <div className="pt-3 border-t border-slate-100">
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full"
              >
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg shadow-xs">
                  {isAuthenticated ? 'Open Console' : 'Sign In to Console'}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION */}
      <section className="pt-10 pb-14 lg:pt-14 lg:pb-18 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Manage your endpoints from one console.
            </h1>

            {/* Supporting Description */}
            <p className="text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              RicozEndpoint provides centralized device management, security policies, patch management, compliance monitoring, and security alerts from one administration console.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm gap-2 text-sm">
                  <span>{isAuthenticated ? 'Open Admin Console' : 'Launch Console / Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-5 py-2.5 rounded-lg shadow-xs gap-2 text-sm">
                  <span>See How It Works</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Button>
              </a>
            </div>

            {/* Simple Understated Product Summary */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-500">
              <span>Devices</span>
              <span className="text-slate-300">·</span>
              <span>Policies</span>
              <span className="text-slate-300">·</span>
              <span>Patches</span>
              <span className="text-slate-300">·</span>
              <span>Compliance</span>
              <span className="text-slate-300">·</span>
              <span>Alerts</span>
            </div>
          </div>

          {/* Product Dashboard Preview Mockup */}
          <div className="mt-10 max-w-5xl mx-auto">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Mockup Window Titlebar */}
              <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-slate-300 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                  </div>
                  <span className="ml-3 font-mono text-slate-400 text-[11px] hidden sm:inline">
                    RicozEndpoint / Dashboard
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Tenant: Ricoz Primary Org (Demo)
                  </span>
                  <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30 bg-blue-950/40">
                    Illustrative Console Preview
                  </Badge>
                </div>
              </div>

              {/* Mockup Content Body */}
              <div className="p-4 sm:p-5 bg-slate-50 space-y-4">
                {/* Console Metrics Row (Illustrative Sample Values) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Managed Devices (Example)
                      </span>
                      <Laptop className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900">1,428</span>
                      <span className="text-xs font-semibold text-emerald-600">+14 this week</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full w-[94%]" />
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Active Policies (Example)
                      </span>
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900">24</span>
                      <span className="text-xs text-slate-500 font-medium">100% Enforced</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full w-full" />
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Compliance Posture (Example)
                      </span>
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900">98.6%</span>
                      <span className="text-xs font-semibold text-emerald-600">Optimal</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-[98.6%]" />
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Security Alerts (Example)
                      </span>
                      <Bell className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900">2</span>
                      <span className="text-xs font-semibold text-amber-600">Low Severity</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full w-[12%]" />
                    </div>
                  </div>
                </div>

                {/* Mock Fleet Live Table */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Illustrative Fleet Telemetry Stream (Example Nodes)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">Demonstration Preview</span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>prod-node-01.ricoz.internal</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-600 border-slate-200">
                              Server Node (Example)
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">UUID: 8a4f10bc • IP: 10.240.12.84</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-block text-[11px] text-slate-500 font-mono">
                          Agent v0.1.0 (Active)
                        </span>
                        <Badge variant="success" className="gap-1 font-semibold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Compliant
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                          <Laptop className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>workstation-02.ricoz.internal</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-600 border-slate-200">
                              Workstation (Example)
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">UUID: 9f2b84da • IP: 10.240.18.112</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-block text-[11px] text-slate-500 font-mono">
                          Agent v0.1.0 (Active)
                        </span>
                        <Badge variant="success" className="gap-1 font-semibold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Compliant
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                          <Laptop className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>corp-endpoint-04.ricoz.internal</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-600 border-slate-200">
                              Endpoint (Example)
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">UUID: 3c8e90aa • IP: 10.240.15.42</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-block text-[11px] text-slate-500 font-mono">
                          Agent v0.1.0 (Patch Pending)
                        </span>
                        <Badge variant="warning" className="gap-1 font-semibold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          Patch Queued
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRODUCT OVERVIEW & KEY FEATURES */}
      <section id="features" className="py-14 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Core Capabilities
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise Endpoint Control
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Every feature in RicozEndpoint is engineered to give security and infrastructure teams complete visibility over fleet compliance, vulnerability management, and configuration baselines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Device Telemetry & Inventory
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Capture deep real-time system metrics, hardware specs, OS kernels, network interfaces, and running services across all connected nodes.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Real-time heartbeat & uptime tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Comprehensive hardware & architecture telemetry</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Dynamic Device Groups
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Organize fleets dynamically or statically based on operating systems, departments, subnets, or custom organizational criteria.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Targeted policy deployment by group</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Departmental segmentation & tagging</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Security Policies & Baselines
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Define declarative configuration baselines, firewall profiles, disk encryption mandates, and password requirements with instant rollout.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Strict compliance rule evaluation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Zero-drift automatic enforcement</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Automated Patch Management
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Identify system vulnerabilities, orchestrate critical updates, manage software patches, and schedule controlled maintenance windows.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vulnerability patch tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Staged rollout & reboot controls</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Continuous Compliance Posture
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Run automated posture checks against corporate security standards and instantly flag non-compliant device configurations.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Real-time compliance rate calculation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Exportable audit reports</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="border-slate-200 rounded-lg hover:border-slate-300 shadow-xs transition-colors">
              <CardHeader className="space-y-2.5 pb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Security Alerts & Incident Triage
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs sm:text-sm leading-normal">
                  Receive immediate alerts when nodes trigger security warnings, policy violations, disk full thresholds, or agent disconnection timeouts.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Severity classification (Critical, Warning, Info)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Incident acknowledgment & resolution workflows</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-14 sm:py-18 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Workflow Lifecycle
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              How RicozEndpoint Works
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              From cryptographic token generation to continuous policy convergence, RicozEndpoint operates on an autonomous, resilient architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Step 1 */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <KeyRound className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">1. Provision Tokens</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate cryptographic enrollment tokens from the admin console with specified expiration, usage counts, and assigned default device groups.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <Server className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">2. Deploy Agent</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deploy the lightweight Ricoz agent onto target endpoints using your organization's approved deployment method and token.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">3. Apply Policies</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The agent securely connects over HTTPS, streams system telemetry, pulls assigned security policies, and configures baseline rules.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">4. Central Command</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track fleet health in real time, deploy critical patches with a single click, audit system logs, and triage alerts from the central dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. GETTING STARTED / WORKFLOW SECTION */}
      <section id="tutorial" className="py-14 sm:py-18 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Operational Workflow
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              How RicozEndpoint Works in Practice
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              A straightforward 5-step operational workflow from initial token provisioning to enterprise-wide compliance and telemetry.
            </p>
          </div>

          {/* 5-Step Visual Workflow Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Step 1 */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-white transition-colors flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <KeyRound className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Create Enrollment Token
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Admin creates an enrollment token from <strong>Devices → Enrollment Tokens</strong>.
                </p>
              </div>
              <div className="pt-2.5 mt-3 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Token Provisioning
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-white transition-colors flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <Server className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Enroll Endpoint
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The endpoint agent is deployed using the organization's approved deployment method and enrollment token.
                </p>
              </div>
              <div className="pt-2.5 mt-3 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Agent Deployment
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-white transition-colors flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <Laptop className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Device Registration
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The endpoint authenticates with the RicozEndpoint backend and appears in the Devices inventory.
                </p>
              </div>
              <div className="pt-2.5 mt-3 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Inventory Ingestion
                </span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-white transition-colors flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    4
                  </span>
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Manage & Monitor
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Administrators can view device telemetry, manage device groups, and apply security policies.
                </p>
              </div>
              <div className="pt-2.5 mt-3 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Policy & Groups
                </span>
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-white transition-colors flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    5
                  </span>
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Security & Compliance
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Administrators can monitor compliance, manage patches, and review security alerts.
                </p>
              </div>
              <div className="pt-2.5 mt-3 border-t border-slate-200">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Audit & Alerts
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ARCHITECTURE OVERVIEW */}
      <section id="architecture" className="py-14 sm:py-18 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-2.5 mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Security & Reliability
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Designed for Enterprise Environments
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Engineered with multi-tenant isolation, role-based access control, and cryptographic telemetry integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Token-Authenticated Secure Telemetry</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All telemetry data and policy dispatches between the agent and cloud orchestrator are transmitted securely over HTTPS using token-based authentication with SHA-256 hashed verification.
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Strict Multi-Tenant RBAC</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Support for Super Admins, Org Admins, IT Operators, and Viewers ensures least-privilege administrative access with complete organization segregation.
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Immutable Audit Logging</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every administrative action, policy rollout, agent enrollment, and password change is permanently recorded with actor identity and timestamped logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL PROMINENT CTA SECTION */}
      <section className="py-14 sm:py-18 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex p-3 rounded-lg bg-slate-800 border border-slate-700 text-blue-400">
            <Shield className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Ready to Manage and Secure Your Fleet?
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto font-normal">
            Sign in to the RicozEndpoint administrator console to explore live device telemetry, configure automated compliance policies, and orchestrate updates.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm gap-2 text-sm">
                <span>{isAuthenticated ? 'Enter Console Dashboard' : 'Launch Console / Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 9. ENTERPRISE FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Col 1: Brand & Socials */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-600 text-white">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-base text-white tracking-tight">
                  Ricoz<span className="text-blue-500">Endpoint</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
                Enterprise Endpoint Discovery, Policy Baseline Enforcement & Automated Patch Management Platform.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>Console Status: Operational (99.99%)</span>
              </div>

              {/* Official Social Links */}
              <div className="pt-2 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  Connect With Us
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.facebook.com/ricoz.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Facebook"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/ricoz.social/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.linkedin.com/company/ricoz"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                  <a
                    href="https://wa.link/pfgc6o"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.youtube.com/@RicozInnovations"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="YouTube"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                  <a
                    href="https://x.com/RicozHub"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="X (Twitter)"
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Product Modules</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Device Telemetry
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Security Policies
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Patch Management
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Compliance Posture
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Security Alerts
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Resources */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#tutorial" className="hover:text-white transition-colors">
                    Quickstart Tutorial
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#architecture" className="hover:text-white transition-colors">
                    Architecture & Security
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors font-medium text-blue-400">
                    Administrator Sign In →
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Company & Contact */}
            <div className="space-y-2.5 lg:col-span-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Company & Contact</h4>
              <div className="space-y-2.5 text-slate-400 leading-relaxed">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-[11px]">
                    E-Wing, 301, Tandice69, Prakashwadi Road, Near Gundawali Metro Station, Andheri East, Mumbai – 400069
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <a href="tel:+917050062084" className="text-[11px] hover:text-white transition-colors">
                    +91 70500 62084
                  </a>
                </div>
                <div className="pt-1">
                  <a
                    href="https://wa.link/pfgc6o"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-emerald-400 hover:bg-slate-800 transition-colors"
                  >
                    <span>Chat on WhatsApp</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Legal & Copyright */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <p>© {new Date().getFullYear()} Ricoz Technologies. All rights reserved.</p>
            <div className="flex items-center gap-6 text-[11px]">
              <Link to="/" className="hover:text-slate-300 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/" className="hover:text-slate-300 transition-colors">
                Terms of Service
              </Link>
              <a href="#architecture" className="hover:text-slate-300 transition-colors">
                Security Posture
              </a>
              <span className="text-slate-400 hidden md:inline">Enterprise Platform v0.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
