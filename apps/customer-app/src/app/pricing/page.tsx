"use client";

import React, { useEffect } from "react";
import { Check, Terminal, Cloud, Building2, HelpCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export default function PricingPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Pricing & Self-Hosting | ${brandName}`;
  }, [publicSettings]);

  const plans = [
    {
      name: "Self-Hosted / Core",
      price: "Free",
      period: "forever",
      desc: "Perfect for developers and tech-savvy street vendor cooperatives.",
      icon: Terminal,
      cta: "Clone Repository",
      href: "https://github.com",
      popular: false,
      features: [
        "100% Open Source code access",
        "Unlimited products, stores & orders",
        "Complete ownership of customer data",
        "Self-managed database & backups",
        "Android/iOS app build setups",
        "Community support & docs",
      ]
    },
    {
      name: "Cloud Managed (Pro)",
      price: "$19",
      period: "per month",
      desc: "For local vegetable shops who want everything setup and managed.",
      icon: Cloud,
      cta: "Start 14-Day Free Trial",
      href: "/contactus?plan=cloud",
      popular: true,
      features: [
        "We host everything for you",
        "Automated schema & version updates",
        "Managed FCM push notification pipes",
        "Custom domain registration",
        "Weekly automated database backups",
        "Priority email & chat support",
        "Ready-to-use Android APK wrapper",
      ]
    },
    {
      name: "Custom Enterprise",
      price: "Custom",
      period: "contact sales",
      desc: "For state-wide farmer organizations and multi-store grocery chains.",
      icon: Building2,
      cta: "Schedule Consultation",
      href: "/contactus?plan=enterprise",
      popular: false,
      features: [
        "Everything in Pro plan",
        "Multi-warehouse & distribution centers",
        "Custom delivery driver payroll logic",
        "Advanced sales & analytics reports",
        "White-labeled apps published on Play Store",
        "SLA guaranteed 99.99% uptime",
        "Dedicated account manager support",
      ]
    }
  ];

  const faqs = [
    {
      q: "Is Sbjiwala really open-source?",
      a: "Yes! All apps (Customer client, Admin portal, Vendor panel, Delivery agent layout, and Python FastAPI backend) are licensed under the MIT License and completely open-source."
    },
    {
      q: "What are the hosting requirements for the self-hosted plan?",
      a: "You can host the Python backend on any cloud provider supporting PostgreSQL and Redis (e.g., DigitalOcean, AWS, Render) for under $10/month. The web portals can be hosted for free on platforms like Vercel or Netlify."
    },
    {
      q: "How do push notifications work in the open-source version?",
      a: "We support both native FCM (Firebase Cloud Messaging) and standard VAPID Web Push. You will need to create your own free Firebase project coordinates to enable notifications on your self-hosted build."
    },
    {
      q: "Can I use my own brand name and logo?",
      a: "Absolutely! The entire project is white-labeled. The installation wizard sets up your own brand names, colors, logos, and service area rules automatically."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 font-sans">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Simple Plans For<br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Every Small Vendor</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Deploy Sbjiwala on your own infrastructure for free, or let our core engineering team host, configure, and monitor your cloud setup.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        {plans.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.name}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between transition-all duration-300 ${p.popular
                ? "bg-slate-900 border-emerald-500 dark:bg-slate-950/80 shadow-xl scale-[1.03]"
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm"
                }`}
            >
              {p.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-extrabold text-[10px] uppercase px-3 py-1 rounded-full tracking-wider shadow">
                  Most Popular
                </span>
              )}

              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div className={`p-2.5 rounded-xl ${p.popular ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className={`font-black text-base ${p.popular ? "text-white" : "text-slate-900 dark:text-white"}`}>
                    {p.name}
                  </h3>
                  <p className={`text-[11px] font-medium leading-relaxed ${p.popular ? "text-slate-400" : "text-slate-550 dark:text-slate-400"}`}>
                    {p.desc}
                  </p>
                </div>

                <div className="pt-2">
                  <p className="leading-none">
                    <span className={`text-4xl font-black ${p.popular ? "text-white" : "text-slate-900 dark:text-white"}`}>{p.price}</span>
                    {p.price !== "Free" && p.price !== "Custom" && (
                      <span className={`text-xs ml-1 font-bold ${p.popular ? "text-slate-400" : "text-slate-500"}`}>USD</span>
                    )}
                  </p>
                  <p className={`text-[10px] font-bold mt-1 ${p.popular ? "text-slate-400" : "text-slate-500"}`}>
                    {p.period}
                  </p>
                </div>

                <hr className={p.popular ? "border-slate-800" : "border-slate-100 dark:border-slate-800"} />

                <ul className="space-y-2.5">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-[11px]">
                      <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${p.popular ? "text-emerald-450" : "text-emerald-600 dark:text-emerald-400"}`} />
                      <span className={p.popular ? "text-slate-300 font-semibold" : "text-slate-600 dark:text-slate-355 font-medium"}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6">
                {p.cta === "Clone Repository" ? (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="block">
                    <Button fullWidth className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
                      <GithubIcon className="w-4 h-4" /> {p.cta}
                    </Button>
                  </a>
                ) : (
                  <Link href={p.href} className="block">
                    <Button
                      fullWidth
                      variant={p.popular ? "primary" : "secondary"}
                      className={`font-extrabold text-xs py-2.5 rounded-xl shadow-md ${p.popular
                        ? "bg-emerald-600 hover:bg-emerald-550 text-white"
                        : "border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-200"
                        }`}
                    >
                      {p.cta}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Accordion Section */}
      <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
        <h3 className="text-xl font-black text-slate-905 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-emerald-500" /> Hosting & Pricing FAQ
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{faq.q}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action Banner */}
      <div className="bg-slate-900 dark:bg-slate-950/80 border border-slate-850 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-lg text-center md:text-left">
          <h4 className="text-xl font-black">Want to deploy custom business logistics?</h4>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Get in touch with our solutions engineers to build automated pricing schemas, API integrations with POS software, and local driver dispatch optimization.
          </p>
        </div>
        <Link href="/contactus" className="flex-shrink-0">
          <Button className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold flex items-center gap-2 px-6 py-3 rounded-xl text-xs shadow-md">
            Talk to an Expert <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
