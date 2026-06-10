import React from "react";
import TrackOrderClient from "./TrackOrderClient";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default function TrackOrderPage() {
  return <TrackOrderClient />;
}
