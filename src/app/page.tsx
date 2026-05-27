import Link from "next/link";
import {
  Megaphone,
  Star,
  MessageSquare,
  Shield,
  BarChart3,
  HeartHandshake,
  Send,
  CheckCircle,
  ArrowRight,
  Users,
  Building2,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
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
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Shield className="h-4 w-4" />
            100% authentic feedback — no fake reviews
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight max-w-4xl mx-auto">
            Turn real customer feedback into{" "}
            <span className="text-blue-600">honest reviews</span>
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto">
            Collect feedback. Request honest reviews. Recover unhappy customers before they
            become public complaints. Reputation automation for local businesses, agencies,
            and service brands.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-lg"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-lg"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "94%", label: "Average Response Rate" },
              { value: "4.6x", label: "More Reviews Generated" },
              { value: "73%", label: "Recovery Success Rate" },
              { value: "2,500+", label: "Businesses Trust Us" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need for reputation management
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              One platform to collect feedback, amplify honest reviews, and recover
              unhappy customers.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: "Smart Feedback Collection",
                description:
                  "Send feedback requests by email or SMS. Customers rate 1-5 and leave comments in under 30 seconds.",
              },
              {
                icon: <Star className="h-6 w-6" />,
                title: "Honest Review Requests",
                description:
                  "Happy customers get a polite request to leave an honest review on Google, Facebook, Trustpilot, or Yelp.",
              },
              {
                icon: <HeartHandshake className="h-6 w-6" />,
                title: "Customer Recovery",
                description:
                  "Unhappy customers trigger recovery tickets. Fix problems before they become public complaints.",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Reputation Analytics",
                description:
                  "Track ratings, response rates, review clicks, recovery success, and sentiment trends across locations.",
              },
              {
                icon: <Send className="h-6 w-6" />,
                title: "Campaign Automation",
                description:
                  "Create feedback campaigns for specific services, locations, or customer segments.",
              },
              {
                icon: <Building2 className="h-6 w-6" />,
                title: "Multi-Location Support",
                description:
                  "Manage feedback and reviews across multiple locations with location-specific analytics.",
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600 w-fit mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How EchoRank works
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Four simple steps to better reviews and fewer complaints.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                icon: <Users className="h-8 w-8" />,
                title: "Add Customers",
                description: "Upload your customer list or add them individually after each service.",
              },
              {
                step: "2",
                icon: <Send className="h-8 w-8" />,
                title: "Send Feedback Request",
                description: "Customer receives an email or SMS with a simple feedback link.",
              },
              {
                step: "3",
                icon: <Star className="h-8 w-8" />,
                title: "Customer Rates Experience",
                description: "Quick 1-5 star rating with optional comment. Takes 30 seconds.",
              },
              {
                step: "4",
                icon: <Zap className="h-8 w-8" />,
                title: "Smart Routing",
                description:
                  "Happy? Review request. Unhappy? Recovery ticket. Everything is handled automatically.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                  {item.icon}
                </div>
                <div className="text-sm font-medium text-blue-600 mb-1">Step {item.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-900 rounded-2xl p-8 sm:p-12 text-center">
            <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Built for compliance, not manipulation
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8">
              EchoRank helps you collect and amplify authentic customer feedback. We never
              create fake reviews, pressure customers, offer incentives for positive reviews,
              or block unhappy customers from reviewing.
            </p>
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

      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Start free. Upgrade when you&apos;re ready.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$29",
                description: "For small businesses getting started",
                features: [
                  "1 location",
                  "300 feedback requests/month",
                  "Email review requests",
                  "Basic dashboard",
                  "Email support",
                ],
                cta: "Start Free Trial",
                highlighted: false,
              },
              {
                name: "Growth",
                price: "$79",
                description: "For growing businesses",
                features: [
                  "3 locations",
                  "2,000 feedback requests/month",
                  "Email + SMS",
                  "Custom templates",
                  "Full analytics",
                  "Recovery tickets",
                  "Priority support",
                ],
                cta: "Start Free Trial",
                highlighted: true,
              },
              {
                name: "Agency",
                price: "$199",
                description: "For agencies managing clients",
                features: [
                  "20 locations",
                  "10,000 feedback requests/month",
                  "White-label dashboard",
                  "Client accounts",
                  "Custom branding",
                  "API access",
                  "Dedicated support",
                ],
                cta: "Start Free Trial",
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? "bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2"
                    : "bg-white border border-gray-200"
                }`}
              >
                <h3
                  className={`text-lg font-semibold ${plan.highlighted ? "text-blue-100" : "text-gray-500"}`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span className={`text-5xl font-bold ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`ml-1 text-lg ${plan.highlighted ? "text-blue-200" : "text-gray-400"}`}>
                    /month
                  </span>
                </div>
                <p className={`mt-2 text-sm ${plan.highlighted ? "text-blue-200" : "text-gray-500"}`}>
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle
                        className={`h-5 w-5 flex-shrink-0 ${plan.highlighted ? "text-blue-200" : "text-green-500"}`}
                      />
                      <span className={`text-sm ${plan.highlighted ? "text-white" : "text-gray-600"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
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

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Ready to get more honest reviews?
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Join thousands of businesses using EchoRank to collect feedback, amplify honest
            reviews, and fix problems faster.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            Start Your Free Trial
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900">EchoRank</span>
            </div>
            <p className="text-sm text-gray-400">
              Collect feedback. Request honest reviews. Fix problems faster.
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
