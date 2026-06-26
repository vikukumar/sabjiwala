"use client";

import React from "react";
import Link from "next/link";
import VendorLayout, { resolveVendorLink } from "@/components/VendorLayout";

export default function NotFound() {
  return (
    <VendorLayout title="404 - Page Not Found">
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto py-12">
        {/* Animated Tomato SVG */}
        <div className="w-full flex justify-center py-6">
          <svg
            width="200"
            height="180"
            viewBox="0 0 200 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible"
          >
            <defs>
              <radialGradient id="tomato-grad" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="70%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </radialGradient>
              <ellipse id="shadow" cx="100" cy="160" rx="40" ry="10" fill="#000" opacity="0.15" />
            </defs>
            <style>
              {`
                @keyframes tomato-roll {
                  0% {
                    transform: translateX(-40px) rotate(0deg);
                  }
                  50% {
                    transform: translateX(40px) rotate(180deg);
                  }
                  100% {
                    transform: translateX(-40px) rotate(360deg);
                  }
                }
                @keyframes shadow-slide {
                  0% {
                    transform: translateX(-40px) scaleX(1);
                    opacity: 0.15;
                  }
                  50% {
                    transform: translateX(40px) scaleX(0.85);
                    opacity: 0.25;
                  }
                  100% {
                    transform: translateX(-40px) scaleX(1);
                    opacity: 0.15;
                  }
                }
                .tomato-body-group {
                  animation: tomato-roll 4s ease-in-out infinite;
                  transform-origin: 100px 105px;
                }
                .shadow-ellipse {
                  animation: shadow-slide 4s ease-in-out infinite;
                  transform-origin: 100px 160px;
                }
              `}
            </style>
            
            {/* Sliding shadow under the tomato */}
            <g className="shadow-ellipse">
              <use href="#shadow" />
            </g>
            
            {/* Tomato body group */}
            <g className="tomato-body-group">
              {/* Tomato main red shape */}
              <circle cx="100" cy="105" r="45" fill="url(#tomato-grad)" />
              
              {/* Green Stem and leaves */}
              <path
                d="M100 60 C98 50, 102 50, 100 45 C95 52, 92 52, 90 56 C95 58, 97 59, 100 60 Z"
                fill="#10b981"
              />
              <path
                d="M100 60 C110 52, 112 55, 118 52 C110 59, 105 59, 100 60 Z"
                fill="#10b981"
              />
              <path
                d="M100 60 C88 54, 85 57, 80 54 C89 60, 94 60, 100 60 Z"
                fill="#10b981"
              />
              <path
                d="M100 60 C104 62, 106 66, 108 72 C103 68, 101 64, 100 60 Z"
                fill="#10b981"
              />
              <path
                d="M100 60 C96 62, 94 66, 92 72 C97 68, 99 64, 100 60 Z"
                fill="#10b981"
              />
              
              {/* Small main stem branch */}
              <rect x="98" y="42" width="4" height="8" rx="2" fill="#047857" />

              {/* Eyes - Worried look */}
              <circle cx="85" cy="100" r="4.5" fill="#1e293b" />
              <circle cx="115" cy="100" r="4.5" fill="#1e293b" />
              
              {/* Eye highlights */}
              <circle cx="83.5" cy="98.5" r="1.5" fill="white" />
              <circle cx="113.5" cy="98.5" r="1.5" fill="white" />

              {/* Worried Eyebrows */}
              <path d="M78 92 C82 94, 86 94, 90 92" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M110 92 C114 94, 118 94, 122 92" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />

              {/* Sad/Worried Mouth */}
              <path d="M94 118 Q100 112 106 118" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
              
              {/* Blushing cheeks */}
              <circle cx="77" cy="106" r="5" fill="#ef4444" opacity="0.5" />
              <circle cx="123" cy="106" r="5" fill="#ef4444" opacity="0.5" />
            </g>
          </svg>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-emerald-600 dark:text-emerald-400">404</h1>
          <h2 className="text-2xl font-bold tracking-tight">Oops! This tomato rolled off the cart.</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
            We couldn't find the page you were looking for. It might have been harvested, eaten, or moved to another market.
          </p>
        </div>

        {/* Return Button */}
        <div className="pt-2">
          <Link
            href={resolveVendorLink("/")}
            className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-bold px-8 py-3 rounded-full shadow-md hover:shadow-lg transition-all text-sm tracking-wide"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </VendorLayout>
  );
}
