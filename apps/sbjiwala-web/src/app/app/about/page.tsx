"use client";

import React, { useEffect } from "react";
import { Leaf, Users, ShieldCheck, Heart, Award, ChevronRight, Globe, Cpu } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
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

export default function AboutPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Our Open Source Mission | ${brandName}`;
  }, [publicSettings]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 font-sans">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider border border-emerald-500/20">
          <GithubIcon className="w-3.5 h-3.5" />
          100% Open Source Project
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Empowering Local Vendors<br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">With Quick Commerce</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Sbjiwala is a production-grade, hyper-local commerce engine built to liberate neighborhood green grocers, local organic farmers, and micro-merchants from heavy commission cartels.
        </p>
      </div>

      {/* Evolution Story Card */}
      <div className="bg-gradient-to-br from-slate-50 to-emerald-50/10 dark:from-slate-850 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Our Evolution & Vision</h2>
        <div className="grid md:grid-cols-2 gap-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          <p>
            Quick commerce is changing the world, but it has left behind the very people who built the fresh produce economy: small local vendors and family farmers. Heavy commissions, platform exclusivity, and high entry barriers prevent independent vendors from going digital.
          </p>
          <p>
            By making our entire platform open-source, we give every neighborhood merchant, vendor collective, and organic grower co-op the power to launch their own e-commerce app, register delivery boy fleets, bypass intermediate brokers, and keep 100% of their hard-earned profits.
          </p>
        </div>
      </div>

      {/* Core Technology Pillars */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-slate-905 dark:text-white text-center">Platform Architecture</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">Decentralized Routing</h4>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Each vendor runs their own service area. Customer orders routing is determined dynamically using real-time geofencing.
            </p>
          </Card>

          <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">Vendor Independence</h4>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Set your own delivery fees, minimum order amounts, open/close status timings, and custom delivery ranges with absolute control.
            </p>
          </Card>

          <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-black text-slate-900 dark:text-white text-sm">Direct-to-Customer</h4>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Build your own brand, launch native Android or iOS wrappers, run marketing popups, and engage customers directly without middle platforms.
            </p>
          </Card>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl w-fit">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Fair Agricultural Sourcing</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            We bypass middlemen. By connecting local stores directly with village farming collectives, we raise farmer incomes by 35% while keeping customer grocery bills budget-friendly.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl w-fit">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Clean & Ozone-Washed Quality</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            Fresh greens in our catalogs are ozone gas rinsed. This eliminates 99.9% of microbes, pesticide residues, and surface dust without affecting original taste and nutritional profile.
          </p>
        </Card>
      </div>

      {/* Call to Action Banner */}
      <div className="bg-slate-900 dark:bg-slate-950/80 border border-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-2xl" />
        <div className="space-y-4 max-w-xl relative z-10">
          <h2 className="text-2xl font-black">Help Us Evolve Small Businesses</h2>
          <p className="text-xs leading-relaxed text-slate-400 font-semibold">
            Are you a developer, organic grower, street vendor union leader, or local community organizer? Join us in democratizing quick commerce. Download our apps, deploy your own instance, or contribute code on GitHub!
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Button className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs shadow-md">
                <GithubIcon className="w-4 h-4" /> View Open Source Repo
              </Button>
            </a>
            <Link href="/pricing">
              <Button variant="secondary" className="font-extrabold text-xs px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-white cursor-pointer bg-transparent">
                View Pricing Plans <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
