import { Suspense } from "react";
import { Recorder } from "@/components/recorder";

export default function Page() {
  return (
    <Suspense>
      <Recorder />
    </Suspense>
  );
}
