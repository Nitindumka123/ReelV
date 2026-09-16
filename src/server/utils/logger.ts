export interface LogEntry {
  requestId: string;
  timestamp: string;
  endpoint: string;
  duration?: number;
  urlType?: string;
  success: boolean;
  errorCode?: string;
  message: string;
}

export const logger = {
  info: (entry: LogEntry) => {
    console.log(`[INFO] ${JSON.stringify(entry)}`);
  },
  error: (entry: LogEntry) => {
    console.error(`[ERROR] ${JSON.stringify(entry)}`);
  },
  warn: (entry: LogEntry) => {
    console.warn(`[WARN] ${JSON.stringify(entry)}`);
  }
};
