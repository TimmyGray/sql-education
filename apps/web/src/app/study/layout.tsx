import * as React from "react";
import { AppShell } from "@/components/AppShell";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
