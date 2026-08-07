// Cookie Policy body. Shared by the /legal/cookies route and the consent modal.
import type { LegalDoc } from "./types";

const EN: LegalDoc = {
  title: "Cookie Policy",
  description:
    "How Echorank360, operated by ChatLogic Insights LTD, uses cookies and similar technologies on echorank360.com.",
  updated: "Last updated: August 7, 2026",
  sections: [
    { h: "Overview", ps: [
      "This Cookie Policy explains how Echorank360 (\"Service\"), operated by ChatLogic Insights LTD (\"we,\" \"us,\" \"our\"), uses cookies and similar technologies on echorank360.com.",
    ]},
    { h: "1. What Cookies Are", ps: [
      "Cookies are small text files stored on your device by your browser when you visit a website. They allow the site to recognise your browser, keep you signed in, remember your preferences, and understand how the site is used. Similar technologies (such as local storage) are covered by this policy as well.",
    ]},
    { h: "2. Cookies We Use", ps: [
      "2.1 Strictly Necessary. These are required for the Service to function and cannot be switched off. Authentication and session cookies keep you signed in to your dashboard and secure your session (set by our authentication system). Security cookies protect against cross-site request forgery and abuse. Infrastructure cookies are set by Cloudflare, our content delivery and security provider, to distinguish legitimate visitors from automated traffic and maintain site performance.",
      "2.2 Preferences. A locale cookie remembers your selected language and region so pages display in the right locale on return visits.",
      "2.3 Analytics. We use Google Analytics to understand how visitors use the site (pages visited, approximate location, device type) so we can improve the Service. These cookies collect information in aggregate form. You can opt out using Google's browser add-on at https://tools.google.com/dlpage/gaoptout.",
      "2.4 Payments. Subscription payments are processed by Stripe on Stripe-hosted pages. When you proceed to checkout, Stripe sets its own cookies for fraud prevention and payment processing, governed by Stripe's privacy and cookie policies.",
    ]},
    { h: "3. Third-Party Cookies", ps: [
      "Some cookies described above are set by third parties (Cloudflare, Google, Stripe). We do not control these cookies. Please refer to those providers' own policies for details on how they process data.",
    ]},
    { h: "4. Managing Cookies", ps: [
      "You can control and delete cookies through your browser settings — most browsers let you block or delete cookies entirely, or block third-party cookies only. Blocking strictly necessary cookies will prevent you from signing in and using the dashboard. Blocking analytics cookies does not affect Service functionality.",
    ]},
    { h: "5. Changes to This Policy", ps: [
      "We may update this policy from time to time. The \"Last updated\" date above reflects the latest revision. Material changes will be communicated via the Service or by email.",
    ]},
    { h: "6. Contact", ps: [
      "Questions about this policy: support@echorank360.com — ChatLogic Insights LTD",
    ]},
  ],
};

/** EN only for this pass; fr and de-CH read the English body under a banner. */
export const buildCookies = (_locale: string): LegalDoc => EN;
