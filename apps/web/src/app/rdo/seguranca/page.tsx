import { Suspense } from "react";
import { SafetyForm } from "@/components/safety-form";

export default function Page() {
  return (
    <Suspense>
      <SafetyForm />
    </Suspense>
  );
}
