// Moved: Brand Radar now lives in the SEO Tools hub. This stub preserves the
// short-lived /visibility/brand-radar URL (shipped 2026-07-23).
import { redirect } from "next/navigation";

export default function BrandRadarMoved() {
  redirect("/visibility/tools/brand-radar");
}
