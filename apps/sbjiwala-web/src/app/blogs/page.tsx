"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Calendar, Clock, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui/index";
import { useQuery } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";

export default function BlogsPage() {
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await api.get("/installation/public-settings");
      return res.data || {};
    }
  });

  useEffect(() => {
    const brandName = publicSettings?.app_name || "Sbjiwala";
    document.title = `Stories & Blogs | ${brandName}`;
  }, [publicSettings]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { success } = useToast();

  const categories = ["All", "Empowerment", "Logistics", "Direct Sourcing", "Technology"];

  const posts = [
    {
      id: "1",
      title: "How Open Source is Empowering Small Local Vendors",
      excerpt: "Neighborhood street vendors and green grocers are adopting independent digital solutions to escape high commission platforms.",
      category: "Empowerment",
      date: "June 18, 2026",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
      author: "Preeti Singh",
    },
    {
      id: "2",
      title: "Bypassing Middlemen: Sourcing Direct from Farming Co-ops",
      excerpt: "How we coordinate direct sourcing from 450+ village growers, raising farmer earnings by 35% while keeping quality high.",
      category: "Direct Sourcing",
      date: "June 12, 2026",
      readTime: "7 min read",
      image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=600",
      author: "Rahul Sharma",
    },
    {
      id: "3",
      title: "Building Hyper-local Delivery Routing in Under Instant",
      excerpt: "A deep dive into our decentralized routing architecture, using client-side geolocation to dispatch drivers automatically.",
      category: "Logistics",
      date: "June 05, 2026",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&q=80&w=600",
      author: "Aman Gupta",
    },
    {
      id: "4",
      title: "Hosting Your Own Sbjiwala Instance: A Developer Guide",
      excerpt: "Step-by-step tutorial on launching the FastAPI backend with PostgreSQL, Redis, and deploying Next.js portals on Vercel.",
      category: "Technology",
      date: "May 28, 2026",
      readTime: "Instant read",
      image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=600",
      author: "System Admin",
    }
  ];

  const filteredPosts = activeCategory === "All"
    ? posts
    : posts.filter(p => p.category === activeCategory);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setEmail("");
      success("Subscribed successfully! 🥬");
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10 font-sans">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Field Stories &<br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-505 bg-clip-text text-transparent">Tech Deep Dives</span>
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
          Insights on local commerce, open-source delivery operations, and agricultural supply chain improvements.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 max-w-full justify-center">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border cursor-pointer ${activeCategory === cat
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-205 dark:border-slate-800 text-slate-600 dark:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Blog Cards Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No blogs found in this category.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredPosts.map((post) => (
            <Card
              key={post.id}
              className="overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow group rounded-3xl bg-white dark:bg-slate-900/60"
            >
              <div>
                <div className="h-48 overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                    {post.category}
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {post.readTime}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 mt-2">
                <span className="text-[10px] text-slate-400 font-bold">
                  By {post.author}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Read Article <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Newsletter Card */}
      <div className="bg-slate-900 dark:bg-slate-950/80 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-sm text-center md:text-left">
          <h4 className="text-lg font-black flex items-center gap-2 justify-center md:justify-start">
            <BookOpen className="w-5 h-5 text-emerald-500" /> Subscribe to Dev Logs
          </h4>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Get technical updates, release notes, and deployment strategies delivered straight to your inbox.
          </p>
        </div>
        <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto max-w-sm">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 flex-1 md:w-60 min-w-0"
          />
          <Button
            type="submit"
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs px-4 rounded-xl shadow-md cursor-pointer flex-shrink-0"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
          </Button>
        </form>
      </div>
    </div>
  );
}
