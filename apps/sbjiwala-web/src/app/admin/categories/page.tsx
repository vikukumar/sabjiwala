"use client";

import React, { useState, useRef, useEffect } from "react";
import { Tag, Search, Loader2, Plus, ChevronDown, ChevronRight, Download, RefreshCw, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import AdminLayout from "@/components/AdminLayout";

// ─── iOS-style Custom Select ──────────────────────────────────────────────────
function IOSSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative" id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition
          ${open
            ? "border-emerald-500 bg-white dark:bg-slate-900 ring-2 ring-emerald-500/20"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
          } text-slate-900 dark:text-white focus:outline-none disabled:opacity-50 cursor-pointer`}
      >
        <span className="flex items-center gap-2 flex-1 text-left truncate">
          {selected ? (
            <>
              {selected.icon && <span className="text-base leading-none">{selected.icon}</span>}
              <span>{selected.label}</span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  opt.value === value ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/60 dark:bg-emerald-950/30" : "text-slate-900 dark:text-white"
                }`}
              >
                {opt.icon && <span className="text-base">{opt.icon}</span>}
                <span>{opt.label}</span>
                {opt.value === value && <span className="ml-auto text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Default Categories Seed Data ─────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "Vegetables", icon: "🥦", desc: "Fresh farm-to-table vegetables", subs: [
    { name: "Leafy Greens", icon: "🥬", desc: "Spinach, lettuce, methi and more" },
    { name: "Root Vegetables", icon: "🥕", desc: "Carrots, beetroot, radish" },
    { name: "Gourds & Squash", icon: "🥒", desc: "Bottle gourd, ridge gourd, bitter gourd" },
    { name: "Tomatoes & Peppers", icon: "🍅", desc: "Tomatoes, capsicum, green chili" },
    { name: "Onions & Garlic", icon: "🧅", desc: "Onions, garlic, shallots" },
    { name: "Beans & Peas", icon: "🫘", desc: "French beans, cluster beans, peas" },
    { name: "Cabbage & Cauliflower", icon: "🫑", desc: "Cabbage, cauliflower, broccoli" },
    { name: "Potatoes & Yams", icon: "🥔", desc: "Potatoes, sweet potatoes, yam" },
    { name: "Exotic Vegetables", icon: "🌽", desc: "Baby corn, asparagus, zucchini" },
  ]},
  { name: "Fruits", icon: "🍎", desc: "Fresh seasonal fruits", subs: [
    { name: "Citrus Fruits", icon: "🍋", desc: "Oranges, lemons, limes, mosambi" },
    { name: "Tropical Fruits", icon: "🍌", desc: "Bananas, mangoes, pineapple, papaya" },
    { name: "Berries", icon: "🍓", desc: "Strawberries, blueberries, raspberries" },
    { name: "Stone Fruits", icon: "🍑", desc: "Peaches, plums, apricots, cherries" },
    { name: "Melons", icon: "🍈", desc: "Watermelon, muskmelon, honeydew" },
    { name: "Apples & Pears", icon: "🍐", desc: "Red apple, green apple, pear" },
    { name: "Grapes & Pomegranate", icon: "🍇", desc: "Grapes, pomegranate" },
    { name: "Dry Fruits & Nuts", icon: "🥜", desc: "Cashews, almonds, walnuts, dates" },
    { name: "Exotic Fruits", icon: "🥭", desc: "Dragon fruit, kiwi, avocado" },
  ]},
  { name: "Dairy & Eggs", icon: "🥛", desc: "Fresh dairy products and eggs", subs: [
    { name: "Milk", icon: "🥛", desc: "Full-fat, toned, skimmed milk" },
    { name: "Paneer & Tofu", icon: "🧀", desc: "Fresh paneer and tofu" },
    { name: "Curd & Yoghurt", icon: "🫙", desc: "Dahi, Greek yoghurt" },
    { name: "Butter & Ghee", icon: "🧈", desc: "Salted butter, desi ghee" },
    { name: "Cheese", icon: "🧀", desc: "Mozzarella, cheddar, processed cheese" },
    { name: "Eggs", icon: "🥚", desc: "Chicken eggs, organic eggs" },
  ]},
  { name: "Herbs & Spices", icon: "🌿", desc: "Fresh herbs and masalas", subs: [
    { name: "Fresh Herbs", icon: "🌿", desc: "Coriander, mint, curry leaves, basil" },
    { name: "Whole Spices", icon: "🌶️", desc: "Cumin, cardamom, cinnamon, cloves" },
    { name: "Ground Spices", icon: "🫙", desc: "Turmeric, red chili, garam masala" },
    { name: "Ginger & Turmeric", icon: "🧄", desc: "Fresh ginger, turmeric root" },
  ]},
  { name: "Grains & Cereals", icon: "🌾", desc: "Staple grains and lentils", subs: [
    { name: "Rice & Pulses", icon: "🍚", desc: "Basmati rice, moong dal, toor dal" },
    { name: "Wheat & Flour", icon: "🫓", desc: "Whole wheat flour, besan, semolina" },
    { name: "Millets & Oats", icon: "🌾", desc: "Bajra, jowar, ragi, rolled oats" },
  ]},
  { name: "Organic & Natural", icon: "🌱", desc: "Certified organic produce", subs: [
    { name: "Organic Vegetables", icon: "🥦", desc: "NPOP-certified organic vegetables" },
    { name: "Organic Fruits", icon: "🍎", desc: "Naturally grown, pesticide-free fruits" },
    { name: "Superfoods", icon: "🌿", desc: "Moringa, chia seeds, flaxseeds" },
  ]},
  { name: "Beverages", icon: "🧃", desc: "Fresh juices and drinks", subs: [
    { name: "Fresh Juices", icon: "🍊", desc: "Orange, mosambi, pomegranate juice" },
    { name: "Coconut Water", icon: "🥥", desc: "Tender coconut water" },
    { name: "Herbal Drinks", icon: "🍵", desc: "Tulsi water, aam panna, lemon ginger" },
  ]},
  { name: "Bakery & Snacks", icon: "🍞", desc: "Fresh baked goods and snacks", subs: [
    { name: "Breads & Buns", icon: "🍞", desc: "Whole wheat bread, pav, buns" },
    { name: "Cookies & Biscuits", icon: "🍪", desc: "Digestive, cream biscuits" },
    { name: "Namkeen & Chips", icon: "🥨", desc: "Bhujia, mixture, wafers, murukku" },
  ]},
];

export default function AdminCategoriesPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatParentId, setNewCatParentId] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [seeding, setSeeding] = useState(false);

  const { data: categories = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const res = await api.get("/catalog/categories", { params: { all_levels: true } });
      return res.data || [];
    }
  });

  const parentCategories = categories.filter((c: any) => c.parent_id === null);

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.post("/products/categories", {
        name: newCatName,
        description: newCatDesc || null,
        parent_id: newCatParentId || null,
        icon: newCatIcon || null,
        is_active: true,
        sort_order: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      success("Category added to catalog!");
      setNewCatName("");
      setNewCatDesc("");
      setNewCatParentId("");
      setNewCatIcon("");
    },
    onError: (err: any) => {
      showError("Creation Failed", err.response?.data?.detail || err.message);
    }
  });

  // Seed default categories
  const handleSeedDefaults = async () => {
    setSeeding(true);
    let created = 0;
    let updated = 0;
    const parentIdMap: Record<string, string> = {};

    try {
      // Map existing parents
      for (const cat of categories) {
        if (!cat.parent_id) parentIdMap[cat.name] = cat.id;
      }

      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const { name, icon, desc, subs } = DEFAULT_CATEGORIES[i];
        let parentId = parentIdMap[name];

        const existingParent = categories.find((c: any) => c.name.toLowerCase() === name.toLowerCase() && !c.parent_id);

        if (existingParent) {
          try {
            const res = await api.patch(`/products/categories/${existingParent.id}`, {
              name, icon, description: desc, is_active: true, sort_order: i + 1, parent_id: null
            });
            parentId = res.data?.id || existingParent.id;
            parentIdMap[name] = parentId;
            updated++;
          } catch {}
        } else {
          try {
            const res = await api.post("/products/categories", {
              name, icon, description: desc, is_active: true, sort_order: i + 1, parent_id: null
            });
            parentId = res.data?.id;
            if (parentId) parentIdMap[name] = parentId;
            created++;
          } catch {}
        }

        if (parentId) {
          for (let j = 0; j < subs.length; j++) {
            const sub = subs[j];
            const existingSub = categories.find((c: any) => c.name.toLowerCase() === sub.name.toLowerCase() && c.parent_id === parentId);
            if (existingSub) {
              try {
                await api.patch(`/products/categories/${existingSub.id}`, {
                  name: sub.name, icon: sub.icon, description: sub.desc,
                  is_active: true, sort_order: j + 1, parent_id: parentId
                });
                updated++;
              } catch {}
            } else {
              try {
                await api.post("/products/categories", {
                  name: sub.name, icon: sub.icon, description: sub.desc,
                  is_active: true, sort_order: j + 1, parent_id: parentId
                });
                created++;
              } catch {}
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      success(`🎉 Seeding complete! Created ${created} and replaced/updated ${updated} categories.`);
    } catch (err: any) {
      showError("Seeding Failed", err.message);
    } finally {
      setSeeding(false);
    }
  };

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const topLevelFiltered = filteredCategories.filter((c: any) => !c.parent_id);
  const getChildren = (parentId: string) =>
    filteredCategories.filter((c: any) => c.parent_id === parentId);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parentOptions = [
    { value: "", label: "None (Top-level Category)", icon: "📁" },
    ...parentCategories.map((c: any) => ({ value: c.id, label: c.name, icon: c.icon || "🗂️" }))
  ];

  return (
    <AdminLayout title="Product Categories">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-800 dark:text-slate-100 font-sans">

        {/* Create / Seed Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Seed Default Categories */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 shadow-lg text-white">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-black text-sm uppercase tracking-wider">Seed Default Categories</h3>
            </div>
            <p className="text-emerald-100 text-xs leading-relaxed mb-4">
              Automatically create all standard grocery categories — Vegetables, Fruits, Dairy, Herbs, Grains, Organic and more with subcategories and emojis.
            </p>
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="w-full py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {seeding ? "Seeding Categories..." : "Seed All Default Categories"}
            </button>
          </div>

          {/* Create Category Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Add Custom Category</h3>
              <p className="text-xs text-slate-500 mt-1">Create a new category or subcategory manually.</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                addCategoryMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Icon / Emoji</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="🥦"
                    value={newCatIcon}
                    onChange={e => setNewCatIcon(e.target.value)}
                    className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-center text-xl focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Category Name *"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parent Category</label>
                <IOSSelect
                  id="parent-cat-select"
                  value={newCatParentId}
                  onChange={setNewCatParentId}
                  options={parentOptions}
                  placeholder="None (Top-level)"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Describe items in this category..."
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={addCategoryMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
              >
                {addCategoryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {addCategoryMutation.isPending ? "Creating..." : "Create Category"}
              </button>
            </form>
          </div>
        </div>

        {/* Categories Tree */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Category Catalog</h3>
              <p className="text-xs text-slate-500 mt-1">{categories.length} total — {parentCategories.length} parent, {categories.length - parentCategories.length} subcategories</p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => refetch()}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="relative w-48">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
            ) : topLevelFiltered.length > 0 ? (
              topLevelFiltered.map((cat: any) => {
                const children = getChildren(cat.id);
                const isExpanded = expandedParents.has(cat.id) || !!search;
                return (
                  <div key={cat.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                    >
                      <span className="text-2xl">{cat.icon || "🗂️"}</span>
                      <div className="flex-1">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">{cat.name}</p>
                        {cat.description && (
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                          {children.length} sub
                        </span>
                        <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </span>
                      </div>
                    </button>

                    {isExpanded && children.length > 0 && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900/50">
                        {children.map((sub: any) => (
                          <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition">
                            <span className="text-lg">{sub.icon || "🏷️"}</span>
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{sub.name}</p>
                              {sub.description && (
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{sub.description}</p>
                              )}
                            </div>
                            <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold uppercase">Sub</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <Tag className="w-10 h-10 mx-auto opacity-30" />
                <p>No categories found.</p>
                <p className="text-slate-500">Click "Seed All Default Categories" to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
