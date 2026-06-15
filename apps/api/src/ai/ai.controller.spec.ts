import { NotFoundException } from "@nestjs/common";
import type { AiStreamEvent } from "@sql-edu/contracts";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AskDto } from "./dto/ask.dto";

interface FakeRes {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
  statusCode?: number;
  body?: unknown;
  chunks: string[];
}

function makeRes(): FakeRes {
  const res = { chunks: [] } as unknown as FakeRes;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.setHeader = jest.fn(() => res);
  res.write = jest.fn((chunk: string) => {
    res.chunks.push(chunk);
    return true;
  });
  res.end = jest.fn(() => undefined);
  return res;
}

const sse = (event: AiStreamEvent) => `data: ${JSON.stringify(event)}\n\n`;

describe("AiController", () => {
  let ai: { askStream: jest.Mock };
  let controller: AiController;
  const body = { message: "hi" } as AskDto;

  beforeEach(() => {
    ai = { askStream: jest.fn() };
    controller = new AiController(ai as unknown as AiService);
  });

  it("streams token events then the done event over SSE", async () => {
    const events: AiStreamEvent[] = [
      { type: "token", text: "Hel" },
      { type: "token", text: "lo" },
      { type: "done", refused: false, questionsRemaining: 4, reply: "Hello" },
    ];
    ai.askStream.mockImplementation(async function* () {
      for (const e of events) yield e;
    });
    const res = makeRes();

    await controller.streamAsk("u1", "b1", body, res as never);

    expect(ai.askStream).toHaveBeenCalledWith("u1", "b1", "hi");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream",
    );
    expect(res.chunks).toEqual(events.map(sse));
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns a JSON HTTP error (no SSE headers) when the first step throws an HttpException", async () => {
    ai.askStream.mockImplementation(async function* () {
      throw new NotFoundException({ message: "Block not found" });
    });
    const res = makeRes();

    await controller.streamAsk("u1", "missing", body, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Block not found" });
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("returns a 500 JSON error when the first step throws a non-HTTP error", async () => {
    ai.askStream.mockImplementation(async function* () {
      throw new Error("kaboom");
    });
    const res = makeRes();

    await controller.streamAsk("u1", "b1", body, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  it("emits an SSE error event when the stream fails mid-flight", async () => {
    ai.askStream.mockImplementation(async function* () {
      yield { type: "token", text: "partial" } as AiStreamEvent;
      throw new Error("stream broke");
    });
    const res = makeRes();

    await controller.streamAsk("u1", "b1", body, res as never);

    expect(res.chunks[0]).toBe(sse({ type: "token", text: "partial" }));
    expect(res.chunks[1]).toBe(sse({ type: "error", message: "stream broke" }));
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it("uses a generic message when a non-Error is thrown mid-stream", async () => {
    ai.askStream.mockImplementation(async function* () {
      yield { type: "token", text: "x" } as AiStreamEvent;
      throw "weird";
    });
    const res = makeRes();

    await controller.streamAsk("u1", "b1", body, res as never);

    expect(res.chunks[1]).toBe(sse({ type: "error", message: "Stream error" }));
  });

  it("ends the stream cleanly when the generator yields nothing", async () => {
    ai.askStream.mockImplementation(async function* () {
      // no events
    });
    const res = makeRes();

    await controller.streamAsk("u1", "b1", body, res as never);

    expect(res.write).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
