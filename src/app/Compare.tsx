"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PROFILES, THEOLOGIES } from "@/lib/options";

type Side = {
  theology: string;
  profile: string;
  answer: string;
  error: string;
};

const emptySide = (theology: string): Side => ({
  theology,
  profile: "universal_explorer",
  answer: "",
  error: "",
});

async function openStream(question: string, side: Side, signal: AbortSignal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      theology: side.theology,
      profile: side.profile,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return response.body;
}

async function pump(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

function Panel({
  label,
  side,
  onChange,
}: {
  label: string;
  side: Side;
  onChange: (patch: Partial<Side>) => void;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-zinc-500">
          {label} theology
          <select
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
            value={side.theology}
            onChange={(event) => onChange({ theology: event.target.value })}
          >
            {THEOLOGIES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-zinc-500">
          Profile
          <select
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900"
            value={side.profile}
            onChange={(event) => onChange({ profile: event.target.value })}
          >
            {PROFILES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="answer min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-900">
        {side.error ? (
          <p className="text-red-700">{side.error}</p>
        ) : side.answer ? (
          <ReactMarkdown>{side.answer}</ReactMarkdown>
        ) : (
          <p className="text-zinc-400">Answer will stream here.</p>
        )}
      </div>
    </section>
  );
}

export default function Compare() {
  const [left, setLeft] = useState<Side>(() => emptySide("default"));
  const [right, setRight] = useState<Side>(() => emptySide("catholic"));
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending) return;

    const controller = new AbortController();
    const leftSnapshot = { ...left, answer: "", error: "" };
    const rightSnapshot = { ...right, answer: "", error: "" };
    setLeft(leftSnapshot);
    setRight(rightSnapshot);
    setPending(true);

    const [leftResult, rightResult] = await Promise.allSettled([
      openStream(text, leftSnapshot, controller.signal),
      openStream(text, rightSnapshot, controller.signal),
    ]);

    setPending(false);

    if (leftResult.status === "rejected") {
      setLeft((side) => ({
        ...side,
        error: leftResult.reason?.message ?? "Request failed.",
      }));
    }
    if (rightResult.status === "rejected") {
      setRight((side) => ({
        ...side,
        error: rightResult.reason?.message ?? "Request failed.",
      }));
    }

    await Promise.all([
      leftResult.status === "fulfilled"
        ? pump(leftResult.value, (chunk) =>
            setLeft((side) => ({ ...side, answer: side.answer + chunk })),
          )
        : Promise.resolve(),
      rightResult.status === "fulfilled"
        ? pump(rightResult.value, (chunk) =>
            setRight((side) => ({ ...side, answer: side.answer + chunk })),
          )
        : Promise.resolve(),
    ]);
  }

  return (
    <div
      className={`flex h-dvh flex-col bg-zinc-100 text-zinc-900 transition-opacity ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <Panel
          label="Left"
          side={left}
          onChange={(patch) => setLeft((side) => ({ ...side, ...patch }))}
        />
        <Panel
          label="Right"
          side={right}
          onChange={(patch) => setRight((side) => ({ ...side, ...patch }))}
        />
      </div>
      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-zinc-200 bg-white p-4"
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-3 text-base outline-none focus:border-zinc-500"
          placeholder="Ask a question…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Sending…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
