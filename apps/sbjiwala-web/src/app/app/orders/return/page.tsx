import React, { Suspense } from "react";
import ReturnOrderClient from "./ReturnOrderClient";
import { Spinner } from "@/components/ui/index";

export const metadata = {
  title: "Return Order - Sbjiwala",
  description: "Request a return or refund for your farm-fresh delivered vegetables and fruits.",
};

export default function ReturnPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-32">
        <Spinner size="lg" />
      </div>
    }>
      <ReturnOrderClient />
    </Suspense>
  );
}
