'use client';

import "./globals.css";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Monitor, Zap, Puzzle, Brain,
  Settings, Server, Menu, X, Activity, Cpu, BarChart3, Wrench, Plug, Users, Eye,
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
  return <p className="text-[11px] text-ctp-overlay2 font-mono pl-4 mb-1">{time}</p>;
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
          <meta name="theme-color" content="#1e1e2e" />
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
        <meta name="theme-color" content="#1e1e2e" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="flex h-screen">
          {/* Mobile top bar */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-ctp-mantle border-b border-ctp-surface0 flex items-center justify-between px-4">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-1.5 rounded-lg text-ctp-overlay2 hover:text-ctp-text hover:bg-ctp-surface1/60 transition-all"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <Eye size={22} className="text-ctp-mauve" />
              <span className="text-sm font-bold text-ctp-text tracking-tight">Overwatch</span>
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
            w-[200px] flex-shrink-0 border-r border-ctp-surface0 bg-ctp-mantle flex flex-col
            transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="px-5 pt-5 pb-4 flex items-center">
              <Link href="/" className="group flex items-center gap-2.5">
                <Eye size={24} className="text-ctp-mauve" />
                <div>
                  <h1 className="text-sm font-bold text-ctp-text tracking-tight">Overwatch</h1>
                  <p className="text-[10px] text-ctp-overlay1 tracking-wide">HERMES AGENT</p>
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
                          ? 'bg-ctp-mauve/20 text-ctp-text border border-ctp-mauve/30'
                          : 'text-ctp-overlay1 hover:text-ctp-subtext1 hover:bg-ctp-surface1/50 border border-transparent'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-ctp-lavender' : 'text-ctp-overlay0'} />
                      {label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-ctp-lavender" />}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-ctp-surface0">
              <div className="px-4 pb-4 pt-3">
                <LiveClock />
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-ctp-green pulse-dot" />
                  <p className="text-[11px] text-ctp-overlay2">System Online</p>
                </div>
                <p className="text-[10px] text-ctp-overlay0 mt-1.5 pl-4">localhost:3333</p>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            <main className="flex-1 overflow-auto p-4 lg:p-6 dot-grid pt-16 lg:pt-6">
              {children}
            </main>

            <div className="flex-shrink-0 border-t border-ctp-surface0/50 py-2 text-center text-[10px] text-ctp-overlay1">
              Overwatch v1 · Hermes
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
