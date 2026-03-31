import type {
  DataFastConversionPayload,
  DataFastConversionResult,
} from "./types.js";

const DEFAULT_DATAFAST_API_URL = "https://api.datafast.io";
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

export class DataFastClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = DEFAULT_DATAFAST_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async trackConversion(
    payload: DataFastConversionPayload
  ): Promise<DataFastConversionResult> {
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/v1/conversions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as { id?: string; conversion_id?: string };
          const conversionId = data.id ?? data.conversion_id;
          return conversionId !== undefined
            ? { success: true, conversionId }
            : { success: true };
        }

        // Don't retry client errors (4xx) — they won't change on retry
        if (response.status >= 400 && response.status < 500) {
          const text = await response.text().catch(() => response.statusText);
          return { success: false, error: `DataFast API error ${response.status}: ${text}` };
        }

        const text = await response.text().catch(() => response.statusText);
        lastError = `DataFast API error ${response.status}: ${text}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network error";
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    return { success: false, error: lastError };
  }
}
