"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, ArrowRight, ArrowLeft, Home, Building2, User2
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@sbjiwala/shared";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resolveVendorLink } from "@/components/VendorLayout";
import versionInfo from "@/app/version.json";

interface KYCFormData {
  business_name: string;
  business_type: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  gst_number: string;
  pan_number: string;
  fssai_number: string;
}

export default function KYCOnboarding() {
  const router = useRouter();
  const { success, error, info } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [vendorData, setVendorData] = useState<any>(null);

  const [formData, setFormData] = useState<KYCFormData>({
    business_name: "",
    business_type: "individual",
    contact_email: "",
    contact_phone: "",
    description: "",
    gst_number: "",
    pan_number: "",
    fssai_number: "",
  });

  const [files, setFiles] = useState({
    fssai_doc: null as File | null,
    gst_doc: null as File | null,
    pan_doc: null as File | null,
  });

  const [fileUrls, setFileUrls] = useState({
    fssai_doc: "",
    gst_doc: "",
    pan_doc: "",
  });

  const [uploadProgress, setUploadProgress] = useState({
    fssai_doc: 0,
    gst_doc: 0,
    pan_doc: 0,
  });

  // 1. Fetch current profile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("sw_access_token");
    if (!token) {
      router.replace(resolveVendorLink("/login"));
      return;
    }

    const fetchVendor = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/vendors/me");
        if (res.data) {
          setVendorData(res.data);
          setFormData({
            business_name: res.data.business_name || "",
            business_type: res.data.business_type || "individual",
            contact_email: res.data.contact_email || "",
            contact_phone: res.data.contact_phone || "",
            description: res.data.description || "",
            gst_number: res.data.gst_number || "",
            pan_number: res.data.pan_number || "",
            fssai_number: res.data.fssai_number || "",
          });
        }
      } catch (err: any) {
        error("Error fetching profile", err.response?.data?.detail || err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendor();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: "fssai_doc" | "gst_doc" | "pan_doc") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles((prev) => ({ ...prev, [key]: file }));
      
      // Simulated upload animation
      setUploadProgress((prev) => ({ ...prev, [key]: 10 }));
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev[key] >= 90) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [key]: prev[key] + 15 };
        });
      }, 100);

      try {
        const formDataPayload = new FormData();
        formDataPayload.append("file", file);
        
        const res = await api.post("/storage/upload", formDataPayload, {
          params: { bucket: "public", entity_type: "kyc_doc" },
          headers: { "Content-Type": "multipart/form-data" }
        });

        clearInterval(interval);
        setUploadProgress((prev) => ({ ...prev, [key]: 100 }));
        
        if (res.data && res.data.data) {
          setFileUrls((prev) => ({ ...prev, [key]: res.data.data.url }));
          success("Document pre-uploaded", `${file.name} successfully prepared`);
        }
      } catch (err: any) {
        clearInterval(interval);
        setUploadProgress((prev) => ({ ...prev, [key]: 0 }));
        error("Upload failed", err.response?.data?.detail || err.message);
      }
    }
  };

  const handleNextStep = () => {
    // Basic step validation
    if (step === 1) {
      if (!formData.business_name.trim()) {
        error("Validation Error", "Business name is required");
        return;
      }
      if (!formData.contact_email.trim()) {
        error("Validation Error", "Contact email is required");
        return;
      }
    } else if (step === 2) {
      if (!formData.pan_number.trim() || formData.pan_number.length < 10) {
        error("Validation Error", "Please enter a valid 10-digit PAN number");
        return;
      }
      if (!formData.fssai_number.trim()) {
        error("Validation Error", "FSSAI Registration number is required");
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setStep((prev) => prev - 1);
  };
  const submitKYC = async () => {
    try {
      setIsLoading(true);
      
      const payload = {
        business_name: formData.business_name,
        business_type: formData.business_type,
        description: formData.description,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        gst_number: formData.gst_number || null,
        pan_number: formData.pan_number,
        fssai_number: formData.fssai_number,
        status: "documents_submitted"
      };

      let updateRes;
      if (vendorData) {
        // Update vendor profile and submit docs
        updateRes = await api.patch("/vendors/me", payload);
      } else {
        // Register new vendor profile
        updateRes = await api.post("/vendors/register", payload);
      }

      if (updateRes.data) {
        // Refresh token to get updated user_type claim ("vendor")
        try {
          const refreshToken = localStorage.getItem("sw_refresh_token");
          if (refreshToken) {
            const refreshRes = await api.post("/auth/refresh", { refresh_token: refreshToken });
            if (refreshRes.success && refreshRes.meta) {
              api.setTokens(refreshRes.meta.access_token, refreshRes.meta.refresh_token);
            }
          }
        } catch (refreshErr) {
          console.warn("Failed to auto-refresh token:", refreshErr);
        }

        success("KYC Submitted Successfully", "Your documents are now under review by our admin team.");
        setTimeout(() => {
          router.replace(resolveVendorLink("/"));
        }, 1500);
      }
    } catch (err: any) {
      error("Submission failed", err.response?.data?.detail || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <p className="text-slate-550 dark:text-slate-400 text-sm">Loading registration context...</p>
        </div>
      </div>
    );
  }

  const kycStatus = vendorData?.status || "pending";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-650 to-teal-600 dark:from-emerald-900 dark:to-teal-900 p-8 text-white relative">
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider">
            Sbjiwala v{versionInfo.version}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-300" />
            <h1 className="text-xl font-black">Vendor KYC Onboarding</h1>
          </div>
          <p className="text-emerald-100 text-xs">Verify your store credentials to start accepting orders on Sbjiwala.</p>
        </div>

        {/* Status Alert Banners */}
        {kycStatus === "approved" && (
          <div className="m-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">KYC Verified & Approved</h4>
              <p className="text-xs text-slate-550 dark:text-emerald-400/80 mt-0.5">Your store is approved and active. You can go ahead and manage your catalog.</p>
              <Link href={resolveVendorLink("/")} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-450 mt-2 hover:underline">
                <Home className="w-3.5 h-3.5" /> Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {kycStatus === "documents_submitted" && (
          <div className="m-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-2xl flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 animate-spin flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">Documents Under Review</h4>
              <p className="text-xs text-slate-550 dark:text-blue-400/80 mt-0.5">We have received your registration documents. Our admin team will verify details within 24 hours.</p>
              <Link href={resolveVendorLink("/")} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 mt-2 hover:underline">
                <Home className="w-3.5 h-3.5" /> Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {kycStatus === "rejected" && (
          <div className="m-6 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">KYC Rejected / Needs Action</h4>
              <p className="text-xs text-slate-550 dark:text-rose-400/80 mt-0.5">Reason: <span className="font-semibold text-rose-700 dark:text-rose-300">{vendorData?.rejection_reason || "Invalid documentation or missing files."}</span></p>
              <p className="text-xs text-slate-550 dark:text-rose-455 mt-1">Please review the details below and re-submit for review.</p>
            </div>
          </div>
        )}

        {/* Step indicators */}
        {kycStatus !== "approved" && kycStatus !== "documents_submitted" && (
          <div className="px-8 pt-6">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-450">
              <span className={step >= 1 ? "text-emerald-600 dark:text-emerald-400" : ""}>1. Business Info</span>
              <span className={step >= 2 ? "text-emerald-600 dark:text-emerald-400" : ""}>2. Tax & FSSAI</span>
              <span className={step >= 3 ? "text-emerald-600 dark:text-emerald-400" : ""}>3. Uploads</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
              <div className={`h-full bg-emerald-500 transition-all duration-300 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`}></div>
            </div>
          </div>
        )}

        {/* Form Body */}
        {kycStatus !== "approved" && kycStatus !== "documents_submitted" && (
          <div className="p-8 space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Business Name
                  </label>
                  <input
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Fresh Garden Veggies"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                      <User2 className="w-3.5 h-3.5 text-emerald-600" /> Business Type
                    </label>
                    <select
                      name="business_type"
                      value={formData.business_type}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                    >
                      <option value="individual">Individual / Proprietor</option>
                      <option value="partnership">Partnership Firm</option>
                      <option value="company">Private Ltd Company</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">Contact Phone</label>
                    <input
                      type="text"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleInputChange}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">Contact Email</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    placeholder="e.g. store@freshgarden.com"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">Store Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Write a brief overview about your store, produce quality, and locations."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                  ></textarea>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">PAN Card Number</label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number}
                    onChange={handleInputChange}
                    placeholder="10-digit alphanumeric card number"
                    maxLength={10}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm uppercase transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450">FSSAI License / Registration No</label>
                  <input
                    type="text"
                    name="fssai_number"
                    value={formData.fssai_number}
                    onChange={handleInputChange}
                    placeholder="14-digit state/central license number"
                    maxLength={14}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-450 flex items-center justify-between">
                    <span>GSTIN (GST Number)</span>
                    <span className="text-[10px] font-medium text-slate-400 capitalize">Optional for individual stores</span>
                  </label>
                  <input
                    type="text"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleInputChange}
                    placeholder="15-character GSTIN number"
                    maxLength={15}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm uppercase transition-all"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs text-slate-550 dark:text-emerald-400/80">Submit scans/photos of certificates in PDF or JPEG formats. Size limit 5MB.</p>
                </div>

                {/* FSSAI Upload */}
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-450">FSSAI Certificate Doc *</p>
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-850 hover:border-emerald-500 dark:hover:border-emerald-450 rounded-2xl p-4 transition-all relative flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-850/10">
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, "fssai_doc")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                      {files.fssai_doc ? files.fssai_doc.name : "Choose FSSAI License File"}
                    </span>
                    {uploadProgress.fssai_doc > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-emerald-500" style={{ width: `${uploadProgress.fssai_doc}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN Doc */}
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-450">PAN Card Doc *</p>
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-850 hover:border-emerald-500 dark:hover:border-emerald-450 rounded-2xl p-4 transition-all relative flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-850/10">
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, "pan_doc")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                      {files.pan_doc ? files.pan_doc.name : "Choose PAN Card Scan"}
                    </span>
                    {uploadProgress.pan_doc > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-emerald-500" style={{ width: `${uploadProgress.pan_doc}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* GST Doc */}
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-450">GSTIN Document (Optional)</p>
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-850 hover:border-emerald-500 dark:hover:border-emerald-450 rounded-2xl p-4 transition-all relative flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-850/10">
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, "gst_doc")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                      {files.gst_doc ? files.gst_doc.name : "Choose GST Registration Scan"}
                    </span>
                    {uploadProgress.gst_doc > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-emerald-500" style={{ width: `${uploadProgress.gst_doc}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {step > 1 ? (
                <button
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous Step
                </button>
              ) : (
                <a
                  href="/"
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
                >
                  Cancel
                </a>
              )}

              {step < 3 ? (
                <button
                  onClick={handleNextStep}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-sm"
                >
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={submitKYC}
                  disabled={isLoading || !files.fssai_doc || !files.pan_doc}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit Verification"
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
