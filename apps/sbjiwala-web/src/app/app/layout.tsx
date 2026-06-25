"use client";

import React from "react";
import AppShell from "@/components/AppShell";
import { AppUpdater } from "@sbjiwala/shared";

export default function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <AppUpdater appName="customer" />
    </>
  );
}
