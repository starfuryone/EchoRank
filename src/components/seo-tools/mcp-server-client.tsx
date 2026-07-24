"use client";

// MCP Server tool page body: endpoint, tools, and copyable client snippets.
// Static content + clipboard only — no data fetching beyond the server-
// provided active-key count.

import { useState } from "react";
import Link from "next/link";
import { Copy, Plug } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MCP_TOOLS } from "@/lib/mcp/handler";
import {
  MCP_SERVER_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

const MCP_URL = "https://echorank360.com/api/public/v1/mcp";
const PLACEHOLDER = "er_api_YOUR_KEY";

const CLAUDE_CODE_CMD = `claude mcp add --transport http echorank360 ${MCP_URL} --header "Authorization: Bearer ${PLACEHOLDER}"`;

const MCP_REMOTE_JSON = `{
  "mcpServers": {
    "echorank360": {
      "command": "npx",
      "args": [
        "mcp-remote", "${MCP_URL}",
        "--header", "Authorization: Bearer ${PLACEHOLDER}"
      ]
    }
  }
}`;

function Snippet({
  id,
  text,
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  id: string;
  text: string;
  copied: string | null;
  copyLabel: string;
  copiedLabel: string;
  onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center justify-end border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <Button variant="outline" size="sm" onClick={() => onCopy(id, text)}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {copied === id ? copiedLabel : copyLabel}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function McpServerClient({
  locale,
  activeKeys,
}: {
  locale: DashLocale;
  activeKeys: number;
}) {
  const t = MCP_SERVER_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.mcp_server;
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {it.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t.intro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={activeKeys > 0 ? "success" : "warning"}>
          {activeKeys > 0 ? t.keysActive(activeKeys) : t.noKeys}
        </Badge>
        <Link
          href="/visibility/tools/api-access"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {t.step1Link}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.endpointLabel}</h3>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-800">
              POST {MCP_URL}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyText("url", MCP_URL)}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied === "url" ? t.copied : t.copy}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h3 className="text-base font-semibold text-gray-900">{t.toolsTitle}</h3>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-gray-100">
            {MCP_TOOLS.map((tool) => (
              <li key={tool.name} className="px-6 py-3">
                <code className="font-mono text-sm font-medium text-gray-900">{tool.name}</code>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t.toolDescs[tool.name] ?? tool.description}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.setupTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.step1}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t.step2}
            </p>
            <Snippet id="code" text={CLAUDE_CODE_CMD} copied={copied} copyLabel={t.copy} copiedLabel={t.copied} onCopy={copyText} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t.step3}
            </p>
            <Snippet id="desktop" text={MCP_REMOTE_JSON} copied={copied} copyLabel={t.copy} copiedLabel={t.copied} onCopy={copyText} />
          </div>
          <p className="text-xs text-gray-400">{t.securityNote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
