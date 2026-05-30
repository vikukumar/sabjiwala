import React from "react";
import VerifyVendorClient from "./VerifyVendorClient";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return <VerifyVendorClient />;
}
