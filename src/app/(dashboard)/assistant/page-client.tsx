"use client";

/**
 * /assistant — conversation history beside the shared chat panel.
 *
 * THE PANEL IS THE SAME COMPONENT THE WIDGET USES. This file adds only the
 * history list: loading it, switching between conversations, starting a new
 * one, and deleting one. Everything about sending a turn lives in
 * AssistantPanel, so the two surfaces cannot drift.
 *
 * DELETE ASKS FIRST AND MEANS IT. The API hard-deletes the row and cascades to
 * its messages — there is no trash to recover from — so the confirm is the only
 * thing standing between a mis-click and gone. `window.confirm` rather than a
 * bespoke modal: this repo's modal convention (ToolHelpModal) is for help
 * content, and inventing a second modal system for one destructive confirm is
 * the kind of thing CLAUDE.md's "no bespoke modals" rule exists to prevent.
 */

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssistantPanel, type PanelMessage, type AssistantUsage } from "@/components/assistant/AssistantPanel";
import type { AssistantCopy } from "@/lib/i18n/dashboard";
import type { ConversationListItem } from "@/lib/assistant/pro/store";

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  toolSummary: PanelMessage["toolSummary"];
}

export interface AssistantPageClientProps {
  c: AssistantCopy;
  /** Rendered by the server so the list is right on first paint. */
  initialConversations: ConversationListItem[];
  initialUsage: AssistantUsage;
}

export function AssistantPageClient({
  c,
  initialConversations,
  initialUsage,
}: AssistantPageClientProps) {
  // Seeded from the server render — there is deliberately no fetch-on-mount
  // effect here. The list is refreshed by the events that change it (a turn,
  // a delete), which is when it can actually have changed.
  const [conversations, setConversations] =
    useState<ConversationListItem[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [usage] = useState<AssistantUsage | null>(initialUsage);
  const [resetToken, setResetToken] = useState(0);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/pro/conversations");
      if (!res.ok) return;
      const data = (await res.json()) as { conversations?: ConversationListItem[] };
      setConversations(data.conversations ?? []);
    } catch {
      // A history list we could not load is an empty sidebar, not a broken
      // page — the composer underneath still works.
    }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/pro/conversations/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: TranscriptMessage[] };
      setMessages(
        (data.messages ?? [])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
            toolSummary: message.toolSummary,
          })),
      );
      setActiveId(id);
      setResetToken((token) => token + 1);
    } catch {
      /* leave the current transcript in place */
    }
  }, []);

  const startNew = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    setResetToken((token) => token + 1);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm(c.deleteConfirm)) return;
      try {
        const res = await fetch(`/api/assistant/pro/conversations/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) return;
        if (id === activeId) startNew();
        await loadConversations();
      } catch {
        /* the list refresh below is what would have shown the change */
      }
    },
    [activeId, c.deleteConfirm, loadConversations, startNew],
  );

  const onTurn = useCallback(
    (conversationId: string) => {
      setActiveId(conversationId);
      void loadConversations();
    },
    [loadConversations],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* History */}
      <aside>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{c.history}</h2>
          </div>
          <div className="px-3 py-3">
            <Button variant="outline" size="sm" className="w-full" onClick={startNew}>
              {c.newConversation}
            </Button>
          </div>
          {conversations.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-gray-500">{c.historyEmpty}</p>
          ) : (
            <ul className="max-h-[28rem] overflow-y-auto px-2 pb-3">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      conversation.id === activeId
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(conversation.id)}
                    aria-label={c.deleteLabel}
                    title={c.deleteLabel}
                    className="shrink-0 rounded-md px-2 py-2 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>

      {/* Conversation */}
      <section>
        <Card className="overflow-hidden">
          <div className="h-[calc(100vh-12rem)] min-h-[28rem]">
            {/* KEYED, NOT SYNCED. Switching conversations remounts the panel
                with fresh initial state, which is what React's own guidance
                recommends over an effect that copies props into state — and
                it keeps this file off the set-state-in-effect baseline. */}
            <AssistantPanel
              key={`${activeId ?? "new"}:${resetToken}`}
              c={c}
              variant="page"
              initialMessages={messages}
              initialConversationId={activeId}
              initialUsage={usage}
              onTurn={onTurn}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
