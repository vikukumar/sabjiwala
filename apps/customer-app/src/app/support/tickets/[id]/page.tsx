import React from "react";
import TicketDetailClient from "./TicketDetailClient";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default function TicketDetailPage() {
  return <TicketDetailClient />;
}
