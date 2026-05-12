import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Family portal | DCRS",
  description:
    "Updates, visits, and messages for families and authorised representatives.",
};

export default function FamilyPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
