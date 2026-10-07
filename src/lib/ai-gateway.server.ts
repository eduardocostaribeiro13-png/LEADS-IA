/**
 * Fronteira única com o provedor de IA (Lovable AI Gateway).
 * Trocar de modelo/provedor exige mudar apenas este arquivo.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3.8-flash";

export interface AiCallOptions {
  system: string;
  prompt: string;
  model?: string;
  /** Nome do schema JSON esperado. Quando ausente, devolve texto puro. */
  jsonSchema?: Record<string, unknown>;
  schemaName?: string;
}

export class AiGatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AiGatewayError";
    this.status = status;
  }
}

function friendlyMessage(status: number, fallback: string): string {
  if (status === 402) {
    return "Os créditos de IA do espaço de trabalho acabaram. Adicione créditos para continuar as análises.";
  }
  if (status === 403) {
    return "O uso de IA está bloqueado para este espaço de trabalho.";
  }
  if (status === 429) {
    return "Muitas análises ao mesmo tempo. Aguarde alguns segundos e tente novamente.";
  }
  if (status >= 500) {
    return "O serviço de IA está instável neste momento. Tente novamente em instantes.";
  }
  return fallback;
}

async function requestOnce(body: unknown, apiKey: string): Promise<Response> {
  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });
}

/** Chamada com retry limitado (apenas 429/5xx) e mensagens amigáveis. */
export async function callAi<T = string>(options: AiCallOptions): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new AiGatewayError("A chave de IA não está configurada neste projeto.", 401);
  }

  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ],
  };

  if (options.jsonSchema) {
    body["response_format"] = {
      type: "json_schema",
      json_schema: {
        name: options.schemaName ?? "resultado",
        strict: true,
        schema: options.jsonSchema,
      },
    };
  }

  let lastError: AiGatewayError | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await requestOnce(body, apiKey);
    } catch (error) {
      lastError = new AiGatewayError(
        "Não foi possível falar com o serviço de IA. Verifique a conexão e tente novamente.",
        503,
      );
      console.error("ai-gateway network error", error);
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      if (!options.jsonSchema) return content as T;
      try {
        return JSON.parse(content) as T;
      } catch {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start >= 0 && end > start) {
          return JSON.parse(content.slice(start, end + 1)) as T;
        }
        throw new AiGatewayError("A IA devolveu uma resposta em formato inesperado.", 502);
      }
    }

    const detail = await response.text();
    console.error("ai-gateway error", response.status, detail.slice(0, 500));
    lastError = new AiGatewayError(friendlyMessage(response.status, detail), response.status);

    // Somente 429 e 5xx são reenviáveis.
    if (response.status !== 429 && response.status < 500) throw lastError;

    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const delay = retryAfter > 0 ? retryAfter * 1000 : 800 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError ?? new AiGatewayError("Falha desconhecida ao chamar a IA.", 500);
}
