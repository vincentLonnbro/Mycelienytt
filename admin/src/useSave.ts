import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict" | "blocked";

type Options = {
  url: string;                      
  initialStamp: string;             
  getPayload: () => object | null;  
  delay?: number;
};

export function useAutosave({ url, initialStamp, getPayload, delay = 2000 }: Options) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");

  const stamp = useRef(initialStamp);               
  const dirty = useRef(false);                      
  const failed = useRef(false);
  const stopped = useRef(false);                    
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const payloadRef = useRef(getPayload);
  useEffect(() => {
    payloadRef.current = getPayload;
  });

  const runRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const schedule = useCallback((ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runRef.current(), ms);
  }, []);

  const run = useCallback((): Promise<void> => {
    // One request at a time, so saves can never arrive out of order
    if (running.current) return running.current;
    if (stopped.current || !dirty.current) return Promise.resolve();

    const payload = payloadRef.current();
    if (payload === null) {
      setStatus("blocked");
      return Promise.resolve();
    }

    dirty.current = false;
    setStatus("saving");

    const job = (async () => {
      let retryIn: number | null = null;
      try {
        const res = await api<{ updated_at: string }>(url, {
          method: "PUT",
          body: { ...payload, base_updated_at: stamp.current },
        });
        stamp.current = res.updated_at;
        failed.current = false;
        setSavedAt(new Date());
        setMessage("");
        if (dirty.current) {
          setStatus("dirty"); // the author kept typing while we were saving
          retryIn = 300;
        } else {
          setStatus("saved");
        }
      } catch (err) {
        dirty.current = true;
        failed.current = true;
        if (err instanceof ApiError && err.status === 409) {
          stopped.current = true; // someone else saved first: stop, don't overwrite them
          setStatus("conflict");
        } else if (err instanceof ApiError && err.status < 500) {
          setStatus("error"); // the server rejected the content: retrying won't help
          setMessage(err.message);
        } else {
          setStatus("error"); // network or server trouble: try again soon
          setMessage("Could not reach the server. Retrying…");
          retryIn = 5000;
        }
      } finally {
        running.current = null;
      }
      if (retryIn !== null) schedule(retryIn);
    })();

    running.current = job;
    return job;
  }, [url, schedule]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Call this whenever the title, authors or body change
  const markDirty = useCallback(() => {
    if (stopped.current) return;
    dirty.current = true;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    schedule(delay); // debounce: restarts the countdown on every keystroke
  }, [delay, schedule]);

  // Save right now and wait for it. Returns true if everything is saved.
  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    for (let i = 0; i < 3; i++) {
      await run();
      if (stopped.current) return false;
      if (!dirty.current && !running.current) return true;
      if (failed.current) return false;
    }
    return !dirty.current;
  }, [run]);

  const hasUnsaved = useCallback(() => dirty.current || running.current !== null, []);

  // Leaving the editor by any route (for example the header link): try one last save
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      if (dirty.current && !stopped.current && !running.current) {
        try {
          void runRef.current();
        } catch {
          /* the editor was already torn down */
        }
      }
    };
  }, []);

  return { status, savedAt, message, markDirty, flush, hasUnsaved };
}