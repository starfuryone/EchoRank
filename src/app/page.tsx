import Link from "next/link";
import {
  Megaphone,
  Shield,
  CheckCircle,
  ArrowRight,
  Brain,
  Radar,
  HeartHandshake,
  BarChart3,
  MessageSquare,
  Lock,
  Eye,
  Activity,
  Globe,
  AlertTriangle,
  TrendingUp,
  Star,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Alternative headlines (preserved for A/B testing):                  */
/*   "Your reputation is an asset. Protect it with AI."               */
/*   "The reputation operating system for multi-location brands."     */
/*   "See what your customers will say — before they say it publicly."*/
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Megaphone className="h-7 w-7 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">EchoRank</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900">
                How It Works
              </a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">
                Pricing
              </a>
              <a href="#enterprise" className="text-sm text-gray-600 hover:text-gray-900">
                Enterprise
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Intelligence Assessment
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Brain className="h-4 w-4" />
            AI-Powered Reputation Intelligence
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight max-w-5xl mx-auto leading-tight">
            Detect customer dissatisfaction early.{" "}
            <span className="text-blue-600">Recover unhappy customers</span>{" "}
            before they go public. Monitor reputation risk across every location.
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-3xl mx-auto">
            The AI-powered reputation intelligence platform for businesses that
            can&apos;t afford brand damage. Predict risk, automate recovery, and
            protect your brand across every channel.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-blue-600/25"
            >
              Start Your Intelligence Assessment
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/enterprise"
              className="inline-flex items-center gap-2 px-8 py-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-lg"
            >
              Book Enterprise Demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-8">
            Trusted by 2,500+ businesses
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "87%", label: "Average escalation prediction accuracy" },
              { value: "73%", label: "Recovery success rate" },
              { value: "4.6x", label: "More authentic reviews generated" },
              { value: "$2.3M", label: "Estimated brand damage prevented" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Enterprise-grade reputation intelligence
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Six pillars of AI-powered protection for your brand, customers,
              and bottom line.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <AlertTriangle className="h-6 w-6" />,
                title: "AI Risk Detection",
                description:
                  "Predict which customers will post negative reviews before they do it. Our models analyze sentiment, language patterns, and behavioral signals to flag high-risk interactions in real time.",
              },
              {
                icon: <Radar className="h-6 w-6" />,
                title: "Reputation Monitoring",
                description:
                  "Track your brand across Google, Facebook, Trustpilot, Reddit, X, and more — in real time. Get instant alerts for negative mentions and emerging reputation threats.",
              },
              {
                icon: <HeartHandshake className="h-6 w-6" />,
                title: "Customer Recovery Intelligence",
                description:
                  "AI-prioritized recovery workflows that resolve 73% of complaints before they go public. Automated escalation, smart routing, and resolution tracking.",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Executive Dashboards",
                description:
                  "Reputation scores, risk alerts, and sentiment trends across every location. Board-ready reports that quantify brand health and recovery ROI.",
              },
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: "Smart Feedback Automation",
                description:
                  "Collect authentic feedback and route it through AI-powered intelligence. Multi-channel outreach, smart timing, and personalized follow-ups that drive 4.6x more reviews.",
              },
              {
                icon: <Lock className="h-6 w-6" />,
                title: "Compliance Built-In",
                description:
                  "GDPR-ready data handling, audit trails, and no fake reviews — ever. Full platform policy compliance, consent management, and data retention controls.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all"
              >
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600 w-fit mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              From raw feedback to actionable intelligence
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Four steps to a proactive reputation strategy.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                icon: <Globe className="h-8 w-8" />,
                title: "Connect",
                description:
                  "Set up feedback collection channels and connect your monitoring sources across Google, Facebook, Trustpilot, Reddit, X, and more.",
              },
              {
                step: "2",
                icon: <Brain className="h-8 w-8" />,
                title: "Intelligence",
                description:
                  "AI analyzes every interaction in real time — predicting risk, scoring reputation, and identifying patterns humans miss.",
              },
              {
                step: "3",
                icon: <HeartHandshake className="h-8 w-8" />,
                title: "Recover",
                description:
                  "Automated recovery workflows catch problems early. AI prioritizes cases and suggests resolution strategies that work.",
              },
              {
                step: "4",
                icon: <Eye className="h-8 w-8" />,
                title: "Monitor",
                description:
                  "Real-time reputation monitoring across all platforms. Track trends, benchmark against competitors, and stay ahead of threats.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                  {item.icon}
                </div>
                <div className="text-sm font-medium text-blue-600 mb-1">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ─────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-900 rounded-2xl p-8 sm:p-12 text-center">
            <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Enterprise-grade security and compliance
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8">
              EchoRank is built for regulated industries and brands that demand
              the highest standards of data protection and ethical practices.
              No shortcuts, no compromises.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              {[
                {
                  title: "GDPR Compliant",
                  description: "Full data subject rights, consent management, and EU data residency options",
                },
                {
                  title: "SOC 2 Ready",
                  description: "Security controls, access management, and continuous monitoring infrastructure",
                },
                {
                  title: "Full Audit Trail",
                  description: "Every action logged, searchable, and exportable for compliance reviews",
                },
              ].map((item) => (
                <div key={item.title} className="text-left bg-gray-800/50 rounded-xl p-5">
                  <CheckCircle className="h-6 w-6 text-green-400 mb-2" />
                  <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-xs">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                "No fake reviews",
                "No review gating",
                "No incentivized reviews",
                "Unsubscribe options",
                "Platform policy compliant",
                "Authentic feedback only",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-left">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Plans that scale with your reputation needs
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Start free. Upgrade as your business grows.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$49",
                description: "For small businesses getting started",
                features: [
                  "1 location",
                  "500 requests/month",
                  "Email only",
                  "Basic dashboard",
                  "Email support",
                ],
                cta: "Start Free Trial",
                href: "/register?plan=starter",
                highlighted: false,
              },
              {
                name: "Growth",
                price: "$149",
                description: "For businesses that need AI insights",
                features: [
                  "5 locations",
                  "5,000 requests/month",
                  "Email + SMS",
                  "AI risk scoring",
                  "Recovery tickets",
                  "Advanced analytics",
                  "Escalation prediction",
                ],
                cta: "Start Free Trial",
                href: "/register?plan=growth",
                highlighted: true,
              },
              {
                name: "Agency",
                price: "$349",
                description: "For agencies managing clients",
                features: [
                  "25 locations",
                  "15,000 requests/month",
                  "White-label dashboard",
                  "Client management",
                  "API access",
                  "Custom domain",
                  "Priority support",
                ],
                cta: "Start Free Trial",
                href: "/register?plan=agency",
                highlighted: false,
              },
              {
                name: "Enterprise",
                price: "$999",
                description: "Full intelligence at scale",
                features: [
                  "Unlimited locations",
                  "Custom volume",
                  "Full AI intelligence",
                  "Reputation monitoring",
                  "SSO / SAML",
                  "SLA guarantee",
                  "Dedicated support",
                  "Executive dashboards",
                  "Custom integrations",
                ],
                cta: "Book Enterprise Demo",
                href: "/enterprise",
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? "bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2"
                    : "bg-white border border-gray-200"
                }`}
              >
                <h3
                  className={`text-lg font-semibold ${
                    plan.highlighted ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span
                    className={`text-4xl font-bold ${
                      plan.highlighted ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`ml-1 text-lg ${
                      plan.highlighted ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    /mo
                  </span>
                </div>
                <p
                  className={`mt-2 text-sm ${
                    plan.highlighted ? "text-blue-200" : "text-gray-500"
                  }`}
                >
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle
                        className={`h-4 w-4 flex-shrink-0 ${
                          plan.highlighted ? "text-blue-200" : "text-green-500"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          plan.highlighted ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 block text-center px-6 py-3 rounded-lg font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Enterprise CTA ─────────────────────────────────────────── */}
      <section id="enterprise" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 sm:p-12 lg:p-16">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Built for enterprise reputation management
                </h2>
                <p className="text-blue-100 text-lg mb-6">
                  Multi-location brands, franchise networks, and regulated
                  industries rely on EchoRank to protect their most valuable
                  asset — their reputation.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Unlimited locations with centralized intelligence",
                    "SSO/SAML authentication and role-based access",
                    "99.9% uptime SLA with dedicated support",
                    "Custom integrations with your existing tech stack",
                    "Executive dashboards and board-ready reporting",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-blue-200 flex-shrink-0" />
                      <span className="text-white text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition-colors text-lg"
                  >
                    Start Your Intelligence Assessment
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/enterprise"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-white font-medium rounded-lg border border-white/30 hover:bg-white/10 transition-colors text-lg"
                  >
                    Book Enterprise Demo
                  </Link>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
                    <Activity className="h-8 w-8 text-blue-200" />
                    <div>
                      <p className="text-white font-semibold">Real-time Risk Monitoring</p>
                      <p className="text-blue-200 text-sm">247 active sources across 12 locations</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
                    <TrendingUp className="h-8 w-8 text-green-300" />
                    <div>
                      <p className="text-white font-semibold">Reputation Score: 94.2</p>
                      <p className="text-blue-200 text-sm">Up 3.8 points this quarter</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4">
                    <Star className="h-8 w-8 text-yellow-300" />
                    <div>
                      <p className="text-white font-semibold">4.7 Average Rating</p>
                      <p className="text-blue-200 text-sm">Across 2,340 reviews this month</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Your reputation is too important to leave unprotected
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Join 2,500+ businesses using EchoRank to detect risk early, recover
            unhappy customers, and build lasting brand trust.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-blue-600/25"
            >
              Start Your Intelligence Assessment
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/enterprise"
              className="inline-flex items-center gap-2 px-8 py-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-lg"
            >
              Book Enterprise Demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900">EchoRank</span>
            </div>
            <p className="text-sm text-gray-400">
              AI-powered reputation intelligence for businesses that can&apos;t afford brand damage.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600">
                Privacy
              </a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600">
                Terms
              </a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
