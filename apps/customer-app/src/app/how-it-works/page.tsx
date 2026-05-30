"use client";

import React, { useEffect } from "react";
import { Clock, Truck, ShieldAlert, Award, Compass, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui/index";

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = "How It Works — Sourcing & Delivery | Sbjiwala.in";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Step-by-step walkthrough of Sbjiwala's express fulfillment cycle. From field harvesting at 4 AM to multi-stage ozone cleaning and 10-minute drop-offs."
      );
    }
  }, []);

  const timelineSteps = [
    {
      time: "04:00 AM",
      title: "Harvesting & Sourcing",
      desc: "Farmers harvest organic vegetables and ripe fruits at dawn. Produce is checked for sap freshness and directly loaded into climate-controlled vehicles.",
      icon: Compass,
      color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450",
    },
    {
      time: "07:00 AM",
      title: "Sorting & Ozone Cleaning",
      desc: "Items arrive at our dark stores. Certified staff sort out any bruised pieces and run all produce through 3-stage ozone washes to sterilize and wash off microbes.",
      icon: Award,
      color: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-450",
    },
    {
      time: "09:00 AM",
      title: "Static Temp insulated Packing",
      desc: "Fresh greens are cataloged, weighed, and sealed in breathable, bio-degradable zip-lock packs before being placed in cooling bins.",
      icon: Clock,
      color: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-450",
    },
    {
      time: "Your Order",
      title: "10-Minute Express Dispatch",
      desc: "Once you place an order, our staff picks and packs items in 60 seconds. A delivery agent picks it up and delivers to your home within 10 minutes.",
      icon: Truck,
      color: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">
      {/* Title */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          How <span className="text-emerald-600 dark:text-emerald-450">Sbjiwala</span> Works
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold tracking-wide max-w-md mx-auto leading-relaxed">
          We have engineered a zero-middlemen farm-to-fork logistics pipeline that cuts down traditional transit times from 72 hours to just 16 hours.
        </p>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {timelineSteps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className="flex gap-6 relative items-start animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
              {/* Left Circle Icon */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 z-10 border border-white/10 ${step.color} shadow-md`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Card content */}
              <Card className="flex-1 p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {step.title}
                  </h3>
                  <span className="text-[10px] uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 font-black px-2 py-0.5 rounded-full tracking-wider">
                    {step.time}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {step.desc}
                </p>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Quick CTA */}
      <div className="text-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 space-y-4">
        <h4 className="font-black text-lg text-slate-900 dark:text-white">Taste the Sourced Difference Today</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-semibold">
          Order clean and fresh spinach, tomatoes, herbs, or seasonal mangoes and watch it arrive in 10 minutes flat!
        </p>
        <div>
          <Link href="/categories">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs mx-auto">
              Start Shopping <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
