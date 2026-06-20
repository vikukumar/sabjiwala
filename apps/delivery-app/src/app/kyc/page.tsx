"use client";

import React, { useState, useEffect } from "react";
import {
  BadgeCheck, Upload, FileText, Camera, CheckCircle2, AlertCircle,
  Loader2, X, ChevronRight, Shield, User, Car
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@sbjiwala/shared";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

const KYC_DOCUMENTS = [
  { key: "aadhar_front", label: "Aadhaar Card (Front)", icon: "🪪", description: "Upload front side of Aadhaar Card" },
  { key: "aadhar_back", label: "Aadhaar Card (Back)", icon: "🪪", description: "Upload back side of Aadhaar Card" },
  { key: "driving_license", label: "Driving License", icon: "📋", description: "Valid driving license (front)" },
  { key: "vehicle_rc", label: "Vehicle RC Book", icon: "🚗", description: "Registration Certificate of your vehicle" },
  { key: "photo", label: "Profile Photo", icon: "🤳", description: "Clear face photo (passport size)" },
];

function DocumentCard({ doc, uploaded, onUpload, uploading }: {
  doc: typeof KYC_DOCUMENTS[0];
  uploaded?: { url: string; name: string };
  onUpload: (file: File, key: string) => void;
  uploading: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 space-y-3 transition-all ${uploaded ? "border-emerald-300 dark:border-emerald-800" : "border-slate-200 dark:border-slate-800"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${uploaded ? "bg-emerald-100 dark:bg-emerald-950/30" : "bg-slate-100 dark:bg-slate-800"}`}>
            {uploaded ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <span>{doc.icon}</span>}
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{doc.label}</h4>
            <p className="text-[11px] text-slate-500">{doc.description}</p>
          </div>
        </div>
        {uploaded && (
          <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
            ✓ Uploaded
          </span>
        )}
      </div>

      {uploaded && (
        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{uploaded.name}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onUpload(file, doc.key);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
          uploaded
            ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            : "bg-emerald-600 hover:bg-emerald-500 text-white border-transparent"
        } disabled:opacity-50`}
      >
        {uploading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="w-3.5 h-3.5" /> {uploaded ? "Replace Document" : "Upload File"}</>
        )}
      </button>
    </div>
  );
}

export default function DeliveryKycPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { url: string; name: string }>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["deliveryProfile"],
    queryFn: async () => {
      const res = await api.get("/delivery/profile");
      return res.data;
    },
  });

  // Populate existing KYC documents from profile
  useEffect(() => {
    if (profile?.kyc_documents) {
      const docs: Record<string, { url: string; name: string }> = {};
      profile.kyc_documents.forEach((doc: any) => {
        docs[doc.document_type] = {
          url: doc.file_url,
          name: doc.original_filename || `${doc.document_type} file`
        };
      });
      setUploadedDocs(docs);
    }
  }, [profile]);

  const handleUpload = async (file: File, key: string) => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", key);

      const res = await api.post("/delivery/kyc/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const resAny = res as any;
      const url = resAny.url || resAny.data?.url || resAny.data?.data?.url || URL.createObjectURL(file);
      setUploadedDocs(prev => ({ ...prev, [key]: { url, name: file.name } }));
      success(`${file.name} uploaded! ✓`);
    } catch (err: any) {
      showError("Upload Failed", err.response?.data?.detail || err.message);
    } finally {
      setUploadingKey(null);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => api.post("/delivery/kyc/submit"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryProfile"] });
      success("KYC Documents Submitted! 🎉", "Our team will review your documents within 24-48 hours.");
      router.replace("/");
    },
    onError: (err: any) => showError("Submission Failed", err.response?.data?.detail || err.message),
  });

  const kycStatus = profile?.kyc_status || "pending";
  const isSubmitted = ["documents_submitted", "under_review", "approved"].includes(kycStatus);
  const isApproved = kycStatus === "approved";
  const uploadedCount = Object.keys(uploadedDocs).length;
  const requiredCount = KYC_DOCUMENTS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d10] text-slate-800 dark:text-white">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <ChevronRight className="w-5 h-5 rotate-180 text-slate-600 dark:text-slate-300" />
        </button>
        <div>
          <h1 className="font-black text-slate-900 dark:text-white">KYC Verification</h1>
          <p className="text-xs text-slate-500">Upload required documents</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Status Banner */}
        {isApproved ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 flex items-center gap-3">
            <BadgeCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="font-black text-emerald-800 dark:text-emerald-300">KYC Approved! ✓</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Your account is fully verified. You can start delivering orders.</p>
            </div>
          </div>
        ) : isSubmitted ? (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-black text-blue-800 dark:text-blue-300">Documents Under Review</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400">Your KYC documents are being reviewed. This takes 24-48 hours.</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-black text-amber-800 dark:text-amber-300">KYC Required</h3>
              <p className="text-xs text-amber-600 dark:text-amber-400">Upload all required documents to start receiving delivery orders. All documents are kept secure and confidential.</p>
            </div>
          </div>
        )}

        {/* Progress */}
        {!isApproved && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">Upload Progress</span>
              <span className="text-emerald-600 dark:text-emerald-400">{uploadedCount}/{requiredCount} documents</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(uploadedCount / requiredCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Documents Grid */}
        {!isApproved && (
          <div className="space-y-3">
            {KYC_DOCUMENTS.map(doc => (
              <DocumentCard
                key={doc.key}
                doc={doc}
                uploaded={uploadedDocs[doc.key]}
                onUpload={handleUpload}
                uploading={uploadingKey === doc.key}
              />
            ))}
          </div>
        )}

        {/* Requirements Info */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <h4 className="font-black text-slate-800 dark:text-white text-xs uppercase">Document Requirements</h4>
          <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            {[
              "Files must be JPG, PNG or PDF format",
              "Maximum file size: 5MB per document",
              "Documents must be clear and legible",
              "All documents must be valid and not expired",
              "Your personal details must match your application",
            ].map((req, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Submit Button */}
        {!isSubmitted && (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || uploadedCount < requiredCount}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-900/20"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
            ) : (
              <><BadgeCheck className="w-5 h-5" /> Submit KYC Documents</>
            )}
          </button>
        )}

        <p className="text-center text-[10px] text-slate-400 px-4">
          Your documents are encrypted and stored securely. We comply with all data protection regulations.
        </p>
      </div>
    </div>
  );
}
