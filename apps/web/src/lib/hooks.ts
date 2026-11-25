"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/use-memo */

import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly errors: { field: string; code: string }[] = [],
  ) {
    super(code);
  }
}

export async function unwrap<T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  let result;
  try {
    result = await request;
  } catch {
    throw new ApiError("NETWORK");
  }
  if (result.error !== undefined || result.data === undefined) {
    const problem = (result.error ?? {}) as { code?: string; errors?: { field: string; code: string }[] };
    throw new ApiError(problem.code ?? "UNAVAILABLE", problem.errors);
  }
  return result.data;
}

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; code: string }
  | { status: "ok"; data: T };

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const run = useCallback(fn, deps);
  useEffect(() => {
    let alive = true;
    run().then(
      (data) => alive && setState({ status: "ok", data }),
      (error: unknown) => alive && setState({ status: "error", code: error instanceof ApiError ? error.code : "UNAVAILABLE" }),
    );
    return () => {
      alive = false;
    };
  }, [run, tick]);
  return [state, () => setTick((n) => n + 1)];
}
