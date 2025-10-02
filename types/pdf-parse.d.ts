declare module 'pdf-parse' {
  export type PDFParseResult = {
    text: string
    numrender?: number
    info?: unknown
    metadata?: unknown
    version?: string
  }

  type PdfParse = (dataBuffer: Buffer | Uint8Array, options?: unknown) => Promise<PDFParseResult>

  const pdfParse: PdfParse
  export default pdfParse
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdfParse from 'pdf-parse'
  export default pdfParse
}
