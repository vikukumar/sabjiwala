"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

const FAQ_DATA = [
  {
    category: "Orders",
    items: [
      { q: "How do I track my order?", a: "Go to My Orders, find your order, and tap 'Live Track'. You can see the real-time location of your delivery agent on the map." },
      { q: "Can I cancel my order?", a: "Yes, you can cancel an order if it's still in 'Pending' or 'Confirmed' status. Go to My Orders > Order Detail > Cancel Order." },
      { q: "What if I received wrong items?", a: "Please contact us within 24 hours of delivery via Support. We'll arrange a replacement or full refund." },
    ],
  },
  {
    category: "Delivery",
    items: [
      { q: "What is the delivery time?", a: "We deliver within 10–15 minutes for express orders. Scheduled delivery can be chosen for a specific time window." },
      { q: "Is there a minimum order value?", a: "There is no minimum order value. However, delivery is free for orders above ₹199." },
      { q: "Do you deliver to all areas in Mumbai?", a: "Currently we deliver to select areas. Enter your PIN code on the homepage to check availability in your area." },
    ],
  },
  {
    category: "Payments",
    items: [
      { q: "What payment methods are accepted?", a: "We accept Cash on Delivery (COD), UPI, Credit/Debit Cards, Net Banking, and Sbjiwala Wallet." },
      { q: "How do I get a refund?", a: "Refunds are processed within 5–7 business days to the original payment method. For COD, refunds go to your Sbjiwala Wallet." },
      { q: "What is Sbjiwala Wallet?", a: "Sbjiwala Wallet is a digital wallet where you can add money and use it to pay for orders. It's also where referral rewards and refunds are credited." },
    ],
  },
  {
    category: "Products & Quality",
    items: [
      { q: "How fresh are the vegetables?", a: "We source vegetables directly from local farms every morning. Our produce is cleaned, sorted, and packed fresh daily." },
      { q: "Can I return a product if I'm unhappy with quality?", a: "Yes! We have a no-questions-asked quality guarantee. Contact support within 24 hours of delivery for a full replacement or refund." },
      { q: "Are the weights accurate?", a: "Yes, all products are weighed and verified. We ensure you receive exactly the quantity you ordered, often a bit more." },
    ],
  },
  {
    category: "Account",
    items: [
      { q: "How do I change my phone number?", a: "For security reasons, phone number changes require verification. Please contact our support team to update your registered mobile number." },
      { q: "How does the referral program work?", a: "Share your referral code with friends. When they place their first order, you both get ₹50 wallet credit." },
      { q: "Is my personal data safe?", a: "Yes. We use industry-standard encryption to protect your data. We never share your personal information with third parties without consent." },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const filtered = FAQ_DATA.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Frequently Asked Questions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Find answers to common questions</p>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions..."
          className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">No results for &quot;{search}&quot;</p>
        </div>
      ) : (
        filtered.map((cat) => (
          <div key={cat.category} className="space-y-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{cat.category}</h2>
            <div className="space-y-2">
              {cat.items.map((item) => <FAQItem key={item.q} q={item.q} a={item.a} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
