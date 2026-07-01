import { useCallback, useEffect, useRef, useState } from "react";
import { JupyterKernelRunner } from "../../lib/jupyter-kernel-runner";
import { formatJupyterConnectionError } from "../../lib/jupyter-connection-diagnostics";
import {
  loadJupyterConfig,
  type JupyterConnectionConfig,
  type KernelRunner,
  type KernelStatus,
} from "../../lib/kernel-runner";

export interface UseKernelRunnerResult {
  runner: KernelRunner;
  status: KernelStatus;
  kernelDisplayName: string;
  connectionError: string | null;
  reconnect: () => Promise<void>;
}

export function useKernelRunner(enabled: boolean): UseKernelRunnerResult {
  const runnerRef = useRef<JupyterKernelRunner>(new JupyterKernelRunner());
  const [status, setStatus] = useState<KernelStatus>("disconnected");
  const [kernelDisplayName, setKernelDisplayName] = useState("Python 3");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const config = loadJupyterConfig();
    setStatus("connecting");
    setConnectionError(null);
    try {
      await runnerRef.current.disconnect().catch(() => {});
      await runnerRef.current.connect(config);
      setStatus(runnerRef.current.status);
      setKernelDisplayName(runnerRef.current.displayName);
    } catch (err) {
      setStatus("disconnected");
      setConnectionError(formatJupyterConnectionError(err, config));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void connect();
    return () => {
      void runnerRef.current.disconnect();
    };
  }, [enabled, connect]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setStatus(runnerRef.current.status);
    }, 500);
    return () => window.clearInterval(id);
  }, [enabled]);

  return {
    runner: runnerRef.current,
    status,
    kernelDisplayName,
    connectionError,
    reconnect: connect,
  };
}

export { loadJupyterConfig, type JupyterConnectionConfig };
