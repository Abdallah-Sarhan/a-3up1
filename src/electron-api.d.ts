export {};

declare global {
  interface Window {
    ward39Desktop?: {
      exportDiagnostics: () => Promise<boolean>;
      reportError: (message: string) => void;
      heartbeat: (area: string) => void;
      recordInteraction: (kind: string) => void;
      completeInputTest: () => Promise<boolean>;
      getRuntimeInfo: () => Promise<string>;
    };
  }
}