import { ApiError } from "@/lib/hooks";

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface ReportPdf {
  blob: Blob;
  fileName: string;
}

export async function fetchReportPdf(reportId: string): Promise<ReportPdf> {
  let response: Response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/v1/reports/${reportId}/pdf`, {
      headers: { "X-Api-Key": process.env.NEXT_PUBLIC_API_KEY ?? "", "X-Timezone": timezone() },
    });
  } catch {
    throw new ApiError("NETWORK");
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { code?: string };
    throw new ApiError(problem.code ?? "UNAVAILABLE");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "RDO.pdf";
  return { blob: await response.blob(), fileName };
}

export function saveBlob({ blob, fileName }: ReportPdf) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareReportPdf(pdf: ReportPdf, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  saveBlob(pdf);
  return "downloaded";
}
