export default function medusaError(error: any): never {
  // Medusa SDK v2 usa fetch internamente — el error llega con status + message directo,
  // sin los campos de Axios (error.response.data, error.config, etc.)
  if (error?.status && typeof error.status === "number" && !error.response) {
    console.error("Medusa error:", error.status, error.message);
    throw new Error(error.message || `Request failed with status ${error.status}`);
  }

  if (error?.response) {
    // Axios-style (SDK v1 / axios fallback)
    try {
      if (error.config?.url) {
        const u = new URL(error.config.url, error.config.baseURL);
        console.error("Resource:", u.toString());
      }
      console.error("Response data:", error.response.data);
      console.error("Status code:", error.response.status);
    } catch {}

    const message = error.response.data?.message || error.response.data;
    if (typeof message === "string" && message.length > 0) {
      throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".");
    }
    throw new Error(JSON.stringify(message));
  }

  if (error?.request) {
    throw new Error("No response received.");
  }

  // Fallback — incluye el mensaje original para que Next.js lo pueda serializar
  throw new Error(error?.message || "Unknown error occurred.");
}
