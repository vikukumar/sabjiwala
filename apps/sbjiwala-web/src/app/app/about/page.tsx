"use client";

import React, { useEffect } from "react";
import { Leaf, Users, ShieldCheck, Heart, Award, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button, Card, SectionHeader } from "@/components/ui/index";

export default function AboutPage() {
  useEffect(() => {
    document.title = "Our Story — Procurement & Farms | Sbjiwala - Kisan ke Ghar Se Apke Ghar tak";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Learn how Sbjiwala cuts out middlemen to procure certified organic produce directly from local farms in under 16 hours. Our mission is fresh eating."
      );
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
          <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Direct Farm Sourced
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Hygienic & Fresh Greens<br />
          <span className="text-emerald-600 dark:text-emerald-400">In 10 Minutes</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Procuring organic produce directly from village growers, cleaned in 3-stage ozone washes, and delivered at your doorstep in under 16 hours from harvest.
        </p>
      </div>

      {/* Grid Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-400 rounded-2xl w-fit">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Fair Farm Sourcing</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            We bypass local wholesale markets entirely. By working directly with 450+ verified family farms, we guarantee growers receive up to 35% higher profits.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-400 rounded-2xl w-fit">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Clean & Ozone Washed</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            All greens are sorted, trimmed, and put through proprietary multi-stage ozone gas rinses to eliminate 99.9% of microbes, pesticide residues, and surface dust.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-400 rounded-2xl w-fit">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">AMOLED Cold Chain</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            From the field to your shopping bag, our produce stays at static insulated temperatures, locking in crisp texture and nutrients till the moment of delivery.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-400 rounded-2xl w-fit">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">100% Organic Quality</h3>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            Our farming partners use organic compost, neem-oil sprays, and ancient vermicompost techniques, keeping your kitchen completely chemical-free.
          </p>
        </Card>
      </div>

      {/* Our Mission Banner */}
      <div className="bg-slate-900 dark:bg-slate-950/80 border border-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-xl" />
        <div className="space-y-4 max-w-xl">
          <h2 className="text-2xl font-black">Our Express Mission</h2>
          <p className="text-xs leading-relaxed text-slate-400 font-semibold">
            At Sbjiwala, our vision is simple — healthy eating shouldn't be a luxury. By combining cutting-edge micro-fulfillment logistics with sustainable local agriculture, we aim to make high-quality, pesticide-free vegetables accessible to every household in 10 minutes flat.
          </p>
          <div className="pt-2">
            <Link href="/categories">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center gap-2 px-5 rounded-xl text-xs">
                Browse Fresh Farm Produce <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
