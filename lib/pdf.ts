import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extrai o texto de um CV em PDF.
 * Usa unpdf (build do pdf.js sem dependências nativas, roda no Node/serverless).
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  // Normaliza espaços/quebras sem perder conteúdo.
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
