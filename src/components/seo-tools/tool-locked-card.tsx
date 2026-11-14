// A tool page's locked state: the tool's name, then one card saying which
// plan includes it, with the way to the plan cards on /billing.
//
// Server component (no state, no handlers), so a page whose plan does not
// include the tool renders this INSTEAD of the tool's client: nothing the tool
// would fetch is fetched. The same look as the locked states the Funnels and
// Opportunity Scanner clients draw inline.

import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ToolLockedCard({
  name,
  title,
  body,
  cta,
  href = "/billing#plans",
}: {
  name: string;
  title: string;
  body: string;
  cta: string;
  href?: string;
}) {
  return (
    <div className="space-y-6" data-testid="tool-locked">
      <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
      <Card>
        <CardContent>
          <div className="flex flex-col items-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">{body}</p>
            <Link
              href={href}
              className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {cta}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
