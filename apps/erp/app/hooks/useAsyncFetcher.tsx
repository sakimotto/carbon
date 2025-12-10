import type { Fetcher } from "@remix-run/react";
import { useFetcher } from "@remix-run/react";
import { noop } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

type FetcherOptions = {
  key?: string;
  onStateChange?: (state: Fetcher["state"]) => Promise<void> | void;
};

export function useAsyncFetcher<TData>(options?: FetcherOptions) {
  const onStateChange = options?.onStateChange || noop;

  const fetcher = useFetcher<TData>({
    key: options?.key,
  });

  const instance = useRef<PromiseWithResolvers<TData>>();

  if (!instance.current) {
    instance.current = Promise.withResolvers<TData>();
  }

  const submit = useCallback(
    (...args: Parameters<typeof fetcher.submit>) => {
      fetcher.submit(...args);
      return instance.current!.promise;
    },
    [fetcher, instance]
  );

  const load = useCallback(
    (...args: Parameters<typeof fetcher.load>) => {
      fetcher.load(...args);
      return instance.current!.promise;
    },
    [fetcher, instance]
  );

  useEffect(() => {
    onStateChange(fetcher.state);
    if (fetcher.state === "idle") {
      if (fetcher.data) {
        instance.current?.resolve(fetcher.data as TData); // I think we don't need to use SerializeFrom here
        instance.current = Promise.withResolvers<TData>();
      }
    }
  }, [fetcher.state, fetcher.data, onStateChange]);

  return {
    ...fetcher,
    data: fetcher.data as TData,
    submit,
    load,
  };
}
