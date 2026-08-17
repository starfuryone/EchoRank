"use client";

import { useEffect, useState } from "react";

export default function AiSearchSetupHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        How does this work?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="aish-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <style>{
              "@keyframes aishDash{to{stroke-dashoffset:-24}}" +
              "@keyframes aishPulse{0%,100%{opacity:.45}50%{opacity:1}}" +
              "@keyframes aishPop{0%,60%{transform:scale(0);opacity:0}75%{transform:scale(1.25);opacity:1}85%,100%{transform:scale(1);opacity:1}}" +
              "@keyframes aishDot{0%{offset-distance:0%;opacity:0}8%{opacity:1}92%{opacity:1}100%{offset-distance:100%;opacity:0}}" +
              ".aish-flow{animation:aishDash 1.2s linear infinite}" +
              ".aish-eng{animation:aishPulse 2.4s ease-in-out infinite}" +
              ".aish-check{transform-origin:center;transform-box:fill-box;animation:aishPop 3s ease-in-out infinite}" +
              "@media (prefers-reduced-motion:reduce){.aish-flow,.aish-eng,.aish-check{animation:none}}"
            }</style>

            <div className="flex items-start justify-between">
              <h2 id="aish-title" className="text-lg font-semibold text-gray-900">
                How AI Search tracking works
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <svg viewBox="0 0 460 150" className="mt-4 w-full" role="img" aria-label="A buyer question flows to six AI engines, and each answer is recorded">
              <rect x="6" y="48" width="108" height="54" rx="10" fill="#EFF6FF" stroke="#BFDBFE" />
              <text x="60" y="70" textAnchor="middle" fontSize="10" fill="#1D4ED8" fontWeight="600">A buyer asks</text>
              <text x="60" y="86" textAnchor="middle" fontSize="9" fill="#3B82F6">&quot;Best analytics tool?&quot;</text>

              <line x1="118" y1="75" x2="168" y2="75" stroke="#93C5FD" strokeWidth="2" strokeDasharray="6 6" className="aish-flow" />

              <g fontSize="8.5" fontWeight="600">
                <rect x="172" y="12" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: "0s" }} />
                <text x="205" y="26" textAnchor="middle" fill="#374151">ChatGPT</text>
                <rect x="172" y="40" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: ".4s" }} />
                <text x="205" y="54" textAnchor="middle" fill="#374151">Google AI</text>
                <rect x="172" y="68" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: ".8s" }} />
                <text x="205" y="82" textAnchor="middle" fill="#374151">Perplexity</text>
                <rect x="172" y="96" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: "1.2s" }} />
                <text x="205" y="110" textAnchor="middle" fill="#374151">Claude</text>
                <rect x="246" y="40" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: "1.6s" }} />
                <text x="279" y="54" textAnchor="middle" fill="#374151">Gemini</text>
                <rect x="246" y="68" width="66" height="22" rx="11" fill="#F9FAFB" stroke="#E5E7EB" className="aish-eng" style={{ animationDelay: "2s" }} />
                <text x="279" y="82" textAnchor="middle" fill="#374151">Copilot</text>
              </g>

              <line x1="316" y1="75" x2="356" y2="75" stroke="#93C5FD" strokeWidth="2" strokeDasharray="6 6" className="aish-flow" />

              <rect x="360" y="42" width="94" height="66" rx="10" fill="#F0FDF4" stroke="#BBF7D0" />
              <text x="407" y="62" textAnchor="middle" fontSize="10" fill="#15803D" fontWeight="600">Recorded daily</text>
              <g className="aish-check">
                <circle cx="407" cy="84" r="11" fill="#22C55E" />
                <path d="M401.5 84.5l3.5 3.5 7-7.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </svg>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">1. You describe your brand.</span>{" "}
                Name, website, and optionally your industry, market and competitors. We read your
                homepage once so the questions fit what you actually do.
              </p>
              <p>
                <span className="font-semibold text-gray-900">2. We write the questions buyers ask.</span>{" "}
                Things like &quot;best [your category]&quot; or &quot;[you] vs [competitor]&quot; — you
                can edit them or add your own in step 3.
              </p>
              <p>
                <span className="font-semibold text-gray-900">3. We ask the AI engines every day.</span>{" "}
                Each question goes to the engines you pick, and we record whether the answer mentions
                you, how you are described, and who else gets named.
              </p>
              <p>
                <span className="font-semibold text-gray-900">4. You see the trend and get alerted.</span>{" "}
                Your dashboard shows how often you appear over time, and you get an alert the moment
                you disappear from an answer you used to be in.
              </p>
            </div>

            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Nothing is posted anywhere on your behalf — we only ask questions and read the answers,
              the same way a customer would.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
