'use client';

import { useState, useEffect, useContext } from 'react';
import { ViewContext } from '../../layout';
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
    case 'cli': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
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
      <pre className="text-[11px] font-mono text-neutral-400 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
        {preview}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-1 text-[10px] text-purple-400 hover:text-indigo-300"
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
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
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
        <div className="w-7 h-7 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={13} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-neutral-600 mb-1">You · {msg.timestamp}</p>
          <div className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
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
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={13} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-neutral-600 mb-1">
            Assistant · {msg.timestamp}
            {msg.finish_reason && msg.finish_reason !== 'tool_calls' && (
              <span className="ml-2 text-neutral-700">({msg.finish_reason})</span>
            )}
          </p>
          {msg.content && (
            <div className="text-sm text-neutral-200 whitespace-pre-wrap break-words mb-2">
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
        <div className="w-5 h-5 rounded bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Wrench size={10} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          {msg.tool_name && (
            <p className="text-[10px] text-neutral-600 mb-1">{msg.tool_name} result</p>
          )}
          {msg.content && <ToolResultBlock content={msg.content} />}
        </div>
      </div>
    );
  }

  // Fallback for unknown roles
  return (
    <div className="ml-10 text-xs text-neutral-600">
      <span className="font-medium">[{msg.role}]</span> {msg.content?.slice(0, 200)}
    </div>
  );
}

export default function SessionDetailPage() {
  const { view } = useContext(ViewContext);
  const params = useParams();
  const id = params.id as string;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}?profile=${encodeURIComponent(view)}`);
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
  }, [id, view]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-6 bg-white/[0.04] rounded w-48 mb-4" />
        <div className="h-24 bg-white/[0.03] rounded-xl mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/sessions" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 mb-4">
          <ArrowLeft size={14} /> Back to sessions
        </Link>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error || 'Session not found'}</p>
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
      <Link href="/sessions" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 mb-4">
        <ArrowLeft size={14} /> Sessions
      </Link>

      {/* Session header */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">{session.title || session.id}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(session.source)}`}>
                {session.source}
              </span>
              <span className="text-xs text-neutral-500">{shortModel(session.model)}</span>
              {session.billing_provider && (
                <span className="text-xs text-neutral-600">via {session.billing_provider}</span>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] text-neutral-500">
            <p>{session.started_at}</p>
            {session.duration && <p className="text-neutral-600">{session.duration}</p>}
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
          <p className="text-[10px] text-neutral-600 mt-3">
            End reason: <span className="text-neutral-500">{session.end_reason}</span>
          </p>
        )}
      </div>

      {/* Transcript */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Transcript</h2>
          <p className="text-[10px] text-neutral-600">
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
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
      <span className="text-neutral-600">{icon}</span>
      <div>
        <p className="text-xs font-bold text-neutral-200">{value}</p>
        <p className="text-[9px] text-neutral-600">{label}</p>
      </div>
    </div>
  );
}
