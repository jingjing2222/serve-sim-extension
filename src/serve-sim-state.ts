export interface ServeSimStream {
  url: string;
  streamUrl?: string;
  wsUrl?: string;
  port: number;
  device: string;
  pid?: number;
}

export interface ServeSimListState {
  running: boolean;
  streams: ServeSimStream[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStream(value: unknown): ServeSimStream | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.url !== "string") return undefined;
  if (typeof value.port !== "number") return undefined;
  if (typeof value.device !== "string") return undefined;

  const stream: ServeSimStream = {
    url: value.url,
    port: value.port,
    device: value.device,
  };
  if (typeof value.streamUrl === "string") stream.streamUrl = value.streamUrl;
  if (typeof value.wsUrl === "string") stream.wsUrl = value.wsUrl;
  if (typeof value.pid === "number") stream.pid = value.pid;
  return stream;
}

function parseJsonOutput(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) throw new Error("serve-sim returned empty output.");

  try {
    return JSON.parse(trimmed);
  } catch {
    const line = trimmed.split(/\r?\n/).find((candidate) => candidate.trim().startsWith("{"));
    if (line) return JSON.parse(line);
    throw new Error(`serve-sim returned non-JSON output: ${trimmed}`);
  }
}

export function parseDetachOutput(output: string): ServeSimStream[] {
  const data = parseJsonOutput(output);
  if (!isRecord(data)) throw new Error("serve-sim detach output must be an object.");

  const single = asStream(data);
  if (single) return [single];

  if (Array.isArray(data.devices)) {
    const streams = data.devices
      .map(asStream)
      .filter((stream): stream is ServeSimStream => Boolean(stream));
    if (streams.length > 0) return streams;
  }

  throw new Error("serve-sim detach output did not include any streams.");
}

export function parseListOutput(output: string): ServeSimListState {
  const data = parseJsonOutput(output);
  if (!isRecord(data)) throw new Error("serve-sim list output must be an object.");

  if (data.running === false) {
    return { running: false, streams: [] };
  }

  const single = asStream(data);
  if (data.running === true && single) {
    return { running: true, streams: [single] };
  }

  if (data.running === true && Array.isArray(data.streams)) {
    const streams = data.streams
      .map(asStream)
      .filter((stream): stream is ServeSimStream => Boolean(stream));
    return { running: streams.length > 0, streams };
  }

  return { running: false, streams: [] };
}

export function pickFirstStream(streams: readonly ServeSimStream[]): ServeSimStream | undefined {
  return streams[0];
}
