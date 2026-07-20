// app/[locale]/demo/page.tsx — shareable, indexable page for the product
// demo video. The homepage opens the same video in a modal; this URL exists
// for links, sharing and search (VideoObject markup).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { statSync } from "node:fs";
import { join } from "node:path";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { DEMO_VIDEO } from "@/lib/i18n/content";
import { DemoVideoPlayer } from "@/components/demo-video";
import { DEMO_VIDEO_POSTER, DEMO_VIDEO_SRC } from "@/lib/demo-video";
import s from "@/components/demo-video.module.css";
import {
  JsonLd,
  SITE_URL,
  buildMetadata,
  organization,
  videoObject,
  webSite,
} from "@/lib/seo";

/** uploadDate from the real file's mtime — never invented. The fallback is
 * the mtime observed when this page was written, used only if the stat fails
 * (the file must not move; external links point at it). */
function videoUploadDate(): string {
  try {
    const mtime = statSync(join(process.cwd(), "public", DEMO_VIDEO_SRC)).mtime;
    return mtime.toISOString().slice(0, 10);
  } catch {
    return "2026-07-04";
  }
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const d = DEMO_VIDEO[locale];
  return buildMetadata({
    locale,
    path: "/demo",
    title: d.meta.title,
    description: d.meta.description,
    ogImage: DEMO_VIDEO_POSTER,
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const d = DEMO_VIDEO[locale];
  const pageUrl = `${SITE_URL}/${locale}/demo`;

  return (
    <>
      <JsonLd
        graph={[
          organization(locale),
          webSite(locale),
          videoObject({
            name: d.meta.title,
            description: d.meta.description,
            thumbnailUrl: DEMO_VIDEO_POSTER,
            contentUrl: DEMO_VIDEO_SRC,
            uploadDate: videoUploadDate(),
            pageUrl,
            inLanguage: locale,
          }),
        ]}
      />
      <main className={s.demoPage}>
        <div className={s.demoContainer}>
          <Link href={`/${locale}`} className={s.demoBrand}>
            <span className={s.demoDiamond} aria-hidden />
            ECHORANK
          </Link>
          <h1 className={s.demoH1}>{d.h1}</h1>
          <p className={s.demoSub}>{d.sub}</p>
          <DemoVideoPlayer locale={locale} pricingHref={`/${locale}#pricing`} />
          <Link href={`/${locale}`} className={s.backLink}>
            {d.backHome}
          </Link>
        </div>
      </main>
    </>
  );
}
