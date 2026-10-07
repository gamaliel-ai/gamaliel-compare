const GAMALIEL_CHAT = "https://api.gamaliel.ai/v1/chat/completions";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    theology?: string;
    profile?: string;
  };

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "Question is required." }, { status: 400 });
  }

  const upstream = await fetch(GAMALIEL_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      stream: true,
      theology: body.theology || "default",
      profile: body.profile || "universal_explorer",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    return new Response(detail || "Gamaliel request failed.", {
      status: upstream.status || 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      let buffer = "";
      const emit = (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = json.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {
            // Ignore keepalives and partial JSON that arrives split across chunks.
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          emit(decoder.decode());
          if (buffer.trim().startsWith("data:")) emit(`${buffer}\n`);
          controller.close();
          return;
        }
        emit(decoder.decode(value, { stream: true }));
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
