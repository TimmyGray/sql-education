import * as React from "react";
import { AppShell } from "@/components/AppShell";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
