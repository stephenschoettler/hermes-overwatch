'use client';

import "./globals.css";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Monitor, Zap, Puzzle, Brain,
  Settings, Server, Menu, X, Activity, Cpu, BarChart3, Wrench, Plug, Users, Eye,
  RotateCcw,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/sessions', label: 'Sessions', icon: Monitor },
  { href: '/models', label: 'Models', icon: Cpu },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/automation', label: 'Automation', icon: Zap },
  { href: '/skills', label: 'Skills', icon: Puzzle },
  { href: '/plugins', label: 'Plugins', icon: Plug },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/config', label: 'Config', icon: Settings },
  { href: '/system', label: 'System', icon: Server },
];

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <p className="text-[11px] text-neutral-400 font-mono pl-4 mb-1">{time}</p>;
}

function GatewayRestartButton() {
  const [confirming, setConfirming] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleRestart = async () => {
    setRestarting(true);
    setConfirming(false);
    try {
      await fetch('/api/system/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'gateway' }),
      });
    } catch {}
    setRestarting(false);
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] text-neutral-400">Restart?</span>
        <button
          onClick={handleRestart}
          className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={restarting}
      className="flex items-center gap-1.5 mt-2 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors disabled:opacity-40"
    >
      <RotateCcw size={10} className={restarting ? 'animate-spin' : ''} />
      {restarting ? 'Restarting…' : 'Restart gateway'}
    </button>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Login page gets a bare layout
  if (pathname === '/login') {
    return (
      <html lang="en">
        <head>
          <title>Overwatch — Sign In</title>
          <meta name="description" content="Overwatch" />
          <meta name="theme-color" content="#0a0a0f" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Overwatch</title>
        <meta name="description" content="Overwatch — Hermes Agent Dashboard" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="flex h-screen">
          {/* Mobile top bar */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-[#0c0c14] border-b border-white/[0.06] flex items-center justify-between px-4">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <Eye size={22} className="text-purple-400" />
              <span className="text-sm font-bold text-white tracking-tight">Overwatch</span>
            </Link>
            <div className="w-8" />
          </div>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed lg:relative z-20 top-0 left-0 h-full
            w-[200px] flex-shrink-0 border-r border-white/[0.06] bg-[#0c0c14] flex flex-col
            transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="px-5 pt-5 pb-4 flex items-center">
              <Link href="/" className="group flex items-center gap-2.5">
                <Eye size={24} className="text-purple-400" />
                <div>
                  <h1 className="text-sm font-bold text-white tracking-tight">Overwatch</h1>
                  <p className="text-[10px] text-amber-400 tracking-wide">HERMES AGENT</p>
                </div>
              </Link>
            </div>

            <nav className="flex-1 px-3 mt-1 overflow-y-auto">
              <div className="space-y-0.5">
                {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact ? pathname === href : (pathname ?? '').startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? 'bg-indigo-500/[0.15] text-white border border-indigo-500/20'
                          : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-indigo-300' : 'text-neutral-600'} />
                      {label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-white/[0.06]">
              <div className="px-4 pb-4 pt-3">
                <LiveClock />
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <p className="text-[11px] text-neutral-400">System Online</p>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1.5 pl-4">localhost:3333</p>
                <div className="pl-4">
                  <GatewayRestartButton />
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            <main className="flex-1 overflow-auto p-4 lg:p-6 dot-grid pt-16 lg:pt-6">
              {children}
            </main>

            <div className="flex-shrink-0 border-t border-white/[0.04] py-2 text-center text-[10px] text-neutral-500">
              Overwatch v1 · Hermes
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
