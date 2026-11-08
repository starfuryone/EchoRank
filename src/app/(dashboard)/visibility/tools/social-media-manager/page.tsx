import { permanentRedirect } from "next/navigation";

// The old "Social Media Manager" scaffold. Social posting stays in our sister
// product EchoPilot (2026-11-08), so this URL now only forwards to the page
// that promotes it. Kept (not deleted) so old links and bookmarks still land.
export default function Page() {
  permanentRedirect("/visibility/tools/social-posting");
}
