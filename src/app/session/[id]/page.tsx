'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Bot, Wrench, Clock, MessageSquare,
  ChevronDown, ChevronRight, Hash,
} from 'lucide-react';

interface SessionDetail {
  id: string;
  source: string;
  model: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  duration: string;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  reasoning_tokens: number;
  estimated_cost_usd: number;
  end_reason: string;
  billing_provider: string;
}

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface Message {
  id: number;
  role: string;
  content: string | null;
  tool_call_id: string | null;
  tool_calls: ToolCall[] | null;
  tool_name: string | null;
  timestamp: string;
  finish_reason: string | null;
}

function formatTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function shortModel(m: string): string {
  if (!m) return '—';
  return m.replace('claude-', '').replace('gpt-', 'gpt');
}

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-ctp-blue bg-ctp-blue/10 border-ctp-blue/20';
    case 'telegram': return 'text-ctp-sky bg-ctp-sky/10 border-ctp-sky/20';
    case 'cron': return 'text-ctp-yellow bg-ctp-yellow/10 border-ctp-yellow/20';
    default: return 'text-ctp-overlay2 bg-ctp-overlay2/10 border-ctp-overlay2/20';
  }
}

function ToolResultBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  // Try to parse JSON output
  let displayContent = content;
  let isJson = false;
  try {
    const parsed = JSON.parse(content);
    if (parsed.output !== undefined) {
      displayContent = parsed.output;
      isJson = true;
    }
  } catch {}

  const lines = displayContent.split('\n');
  const isLong = lines.length > 8 || displayContent.length > 600;
  const preview = isLong && !expanded
    ? lines.slice(0, 6).join('\n') + (lines.length > 6 ? '\n...' : '')
    : displayContent;

  return (
    <div>
      <pre className="text-[11px] font-mono text-ctp-overlay2 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
        {preview}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-1 text-[10px] text-ctp-mauve hover:text-ctp-lavender"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {expanded ? 'Collapse' : `Expand (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

function ToolCallBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-ctp-yellow/10 text-ctp-yellow border border-ctp-yellow/20">
      <Wrench size={9} />
      {name}
    </span>
  );
}

function MessageBlock({ msg, index }: { msg: Message; index: number }) {
  if (msg.role === 'session_meta') return null;

  if (msg.role === 'user') {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-lg bg-ctp-blue/10 border border-ctp-blue/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={13} className="text-ctp-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-ctp-overlay0 mb-1">You · {msg.timestamp}</p>
          <div className="text-sm text-ctp-subtext1 whitespace-pre-wrap break-words">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  if (msg.role === 'assistant') {
    const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-lg bg-ctp-mauve/10 border border-ctp-mauve/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={13} className="text-ctp-mauve" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-ctp-overlay0 mb-1">
            Assistant · {msg.timestamp}
            {msg.finish_reason && msg.finish_reason !== 'tool_calls' && (
              <span className="ml-2 text-ctp-surface2">({msg.finish_reason})</span>
            )}
          </p>
          {msg.content && (
            <div className="text-sm text-ctp-subtext1 whitespace-pre-wrap break-words mb-2">
              {msg.content}
            </div>
          )}
          {hasToolCalls && (
            <div className="flex flex-wrap gap-1.5">
              {msg.tool_calls!.map((tc, i) => (
                <ToolCallBadge key={tc.id || i} name={tc.function.name} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'tool') {
    return (
      <div className="flex gap-3 ml-10">
        <div className="w-5 h-5 rounded bg-ctp-yellow/10 border border-ctp-yellow/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Wrench size={10} className="text-ctp-yellow" />
        </div>
        <div className="flex-1 min-w-0">
          {msg.tool_name && (
            <p className="text-[10px] text-ctp-overlay0 mb-1">{msg.tool_name} result</p>
          )}
          {msg.content && <ToolResultBlock content={msg.content} />}
        </div>
      </div>
    );
  }

  // Fallback for unknown roles
  return (
    <div className="ml-10 text-xs text-ctp-overlay0">
      <span className="font-medium">[{msg.role}]</span> {msg.content?.slice(0, 200)}
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSession(data.session);
        setMessages(data.messages);
      } catch (e) {
        setError(String(e));
      }
      setLoading(false);
    };
    fetchSession();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-6 bg-ctp-surface0/50 rounded w-48 mb-4" />
        <div className="h-24 bg-ctp-surface0/40 rounded-xl mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-ctp-surface0/40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/sessions" className="flex items-center gap-1.5 text-sm text-ctp-overlay1 hover:text-ctp-subtext0 mb-4">
          <ArrowLeft size={14} /> Back to sessions
        </Link>
        <div className="rounded-xl border border-ctp-red/20 bg-ctp-red/5 p-6 text-center">
          <p className="text-sm text-ctp-red">{error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const assistantMsgCount = messages.filter(m => m.role === 'assistant').length;
  const toolMsgCount = messages.filter(m => m.role === 'tool').length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/sessions" className="flex items-center gap-1.5 text-sm text-ctp-overlay1 hover:text-ctp-subtext0 mb-4">
        <ArrowLeft size={14} /> Sessions
      </Link>

      {/* Session header */}
      <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-5 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-ctp-text">{session.title || session.id}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(session.source)}`}>
                {session.source}
              </span>
              <span className="text-xs text-ctp-overlay1">{shortModel(session.model)}</span>
              {session.billing_provider && (
                <span className="text-xs text-ctp-overlay0">via {session.billing_provider}</span>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] text-ctp-overlay1">
            <p>{session.started_at}</p>
            {session.duration && <p className="text-ctp-overlay0">{session.duration}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <StatChip label="Messages" value={String(session.message_count)} icon={<MessageSquare size={11} />} />
          <StatChip label="Tool Calls" value={String(session.tool_call_count)} icon={<Wrench size={11} />} />
          <StatChip label="Input" value={formatTokens(session.input_tokens)} icon={<Hash size={11} />} />
          <StatChip label="Output" value={formatTokens(session.output_tokens)} icon={<Hash size={11} />} />
          <StatChip label="Cache Read" value={formatTokens(session.cache_read_tokens)} icon={<Hash size={11} />} />
        </div>

        {session.end_reason && (
          <p className="text-[10px] text-ctp-overlay0 mt-3">
            End reason: <span className="text-ctp-overlay1">{session.end_reason}</span>
          </p>
        )}
      </div>

      {/* Transcript */}
      <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ctp-text">Transcript</h2>
          <p className="text-[10px] text-ctp-overlay0">
            {userMsgCount} user · {assistantMsgCount} assistant · {toolMsgCount} tool
          </p>
        </div>

        <div className="space-y-4">
          {messages.filter(m => m.role !== 'session_meta').map((msg, i) => (
            <MessageBlock key={msg.id} msg={msg} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-ctp-surface0/40">
      <span className="text-ctp-overlay0">{icon}</span>
      <div>
        <p className="text-xs font-bold text-ctp-subtext1">{value}</p>
        <p className="text-[9px] text-ctp-overlay0">{label}</p>
      </div>
    </div>
  );
}
