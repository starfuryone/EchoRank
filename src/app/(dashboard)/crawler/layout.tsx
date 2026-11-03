// Paid-subscription gate for /crawler — the same predicate and the same upgrade
// state as the SEO Tools hub layout (../visibility/tools/layout.tsx), which
// covered the crawler before it moved out from under that tree. API routes
// enforce it separately via requirePaidPlan().
import SeoToolsLayout from "../visibility/tools/layout";

export default SeoToolsLayout;
