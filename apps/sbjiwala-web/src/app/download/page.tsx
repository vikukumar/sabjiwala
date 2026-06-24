"use client";

import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Download, Smartphone, Truck, ShieldCheck, HeadphonesIcon } from 'lucide-react';
import axios from 'axios';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface LatestRelease {
  version: string;
  published_at: string;
  assets: ReleaseAsset[];
}

export default function DownloadPage() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sbjiwala.qzz.io/api/v1';
        const { data } = await axios.get(`${apiUrl}/system/latest-release`);
        setRelease(data);
      } catch (err) {
        console.error("Failed to fetch release info", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestRelease();
  }, []);

  const getAppDownloadUrl = (appPrefix: string) => {
    if (!release) return "#";
    const asset = release.assets.find(a => a.name.startsWith(appPrefix) && a.name.endsWith('.apk'));
    return asset ? asset.browser_download_url : "#";
  };

  const getAppSize = (appPrefix: string) => {
    if (!release) return "";
    const asset = release.assets.find(a => a.name.startsWith(appPrefix) && a.name.endsWith('.apk'));
    return asset ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : "";
  };

  const apps = [
    {
      id: "customer",
      name: "Sbjiwala Customer App",
      description: "Order fresh vegetables and fruits directly to your home.",
      icon: <Smartphone className="w-8 h-8 text-emerald-600" />,
      prefix: "sbjiwala-v",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      id: "vendor",
      name: "Sbjiwala Vendor App",
      description: "Manage your farm produce, orders, and earnings.",
      icon: <ShieldCheck className="w-8 h-8 text-blue-600" />,
      prefix: "sbjiwala-vendor-v",
      color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
    },
    {
      id: "delivery",
      name: "Sbjiwala Delivery App",
      description: "For our delivery partners to navigate and fulfill orders.",
      icon: <Truck className="w-8 h-8 text-orange-600" />,
      prefix: "sbjiwala-delivery-v",
      color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      buttonColor: "bg-orange-600 hover:bg-orange-700",
    },
    {
      id: "agent",
      name: "Sbjiwala Agent App",
      description: "Support application for our internal agents.",
      icon: <HeadphonesIcon className="w-8 h-8 text-purple-600" />,
      prefix: "sbjiwala-agent-v",
      color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
      buttonColor: "bg-purple-600 hover:bg-purple-700",
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Download Sbjiwala Apps
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Get the latest versions of our mobile applications. Scan the QR code on your mobile device or download directly.
          </p>
          {loading ? (
            <div className="mt-4 text-sm text-slate-500 animate-pulse">Checking for latest versions...</div>
          ) : release ? (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Latest Release: v{release.version} ({new Date(release.published_at).toLocaleDateString()})
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* QR Code Section */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 text-center border border-slate-100 dark:border-slate-700 sticky top-28">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Scan to Download</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
              Point your camera at this QR code to open this page on your mobile device.
            </p>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm ring-1 ring-slate-100">
              <QRCode
                value={typeof window !== 'undefined' ? window.location.href : "https://sbjiwala.qzz.io/download"}
                size={220}
                level="H"
              />
            </div>
          </div>

          {/* Apps Grid */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
            {apps.map((app) => {
              const downloadUrl = getAppDownloadUrl(app.prefix);
              const size = getAppSize(app.prefix);
              
              return (
                <div key={app.id} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${app.color}`}>
                      {app.icon}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{app.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-2">
                    {app.description}
                  </p>
                  
                  <div className="mt-auto">
                    <a
                      href={downloadUrl}
                      className={`w-full flex items-center justify-center gap-2 ${app.buttonColor} text-white py-3 px-4 rounded-xl font-semibold transition-transform active:scale-[0.98] ${downloadUrl === "#" ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
                    >
                      <Download className="w-5 h-5" />
                      Download APK
                    </a>
                    {size && (
                      <p className="text-center text-xs text-slate-400 mt-3 font-medium">
                        Size: {size}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
