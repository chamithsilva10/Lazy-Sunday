import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { DemoDbService } from "@/lib/db/demo-sqlite"

export const dynamic = "force-dynamic"

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
}

function persistImageBuffer(safeName: string, mimeType: string, buffer: Buffer) {
  // 1. Try writing to public/uploads (local dev / writable root)
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    fs.writeFileSync(path.join(uploadsDir, safeName), buffer)
  } catch {}

  // 2. Try writing to /tmp/uploads (serverless writable /tmp)
  try {
    const tmpUploadsDir = path.join("/tmp", "uploads")
    if (!fs.existsSync(tmpUploadsDir)) {
      fs.mkdirSync(tmpUploadsDir, { recursive: true })
    }
    fs.writeFileSync(path.join(tmpUploadsDir, safeName), buffer)
  } catch {}

  // 3. Persist in SQLite pos_uploads table
  try {
    const base64 = buffer.toString("base64")
    DemoDbService.saveUpload(safeName, mimeType, base64)
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""

    // 1. Multipart Form Data (Device File Upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
      }

      const mimeType = file.type || "image/jpeg"
      const ext = ALLOWED_MIME_TYPES[mimeType] || path.extname(file.name) || ".jpg"
      const customName = typeof file.name === "string" && file.name.startsWith("prod_") ? path.basename(file.name) : ""
      const safeName = customName || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      persistImageBuffer(safeName, mimeType, buffer)

      const publicUrl = `/api/uploads/${safeName}`
      return NextResponse.json({
        success: true,
        url: publicUrl,
        filename: safeName,
        size: buffer.length,
      })
    }

    // 2. JSON Payload (Base64 dataUrl or direct image URL)
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const { dataUrl, url, filename: customFilename } = body

      if (url && typeof url === "string" && !url.startsWith("data:")) {
        return NextResponse.json({ success: true, url: url.trim() })
      }

      const rawDataUrl = dataUrl || (url && url.startsWith("data:") ? url : "")
      if (rawDataUrl && typeof rawDataUrl === "string") {
        const matches = rawDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (!matches || matches.length !== 3) {
          return NextResponse.json({ success: false, error: "Invalid base64 data URL" }, { status: 400 })
        }

        const mime = matches[1]
        const base64Data = matches[2]
        const ext = ALLOWED_MIME_TYPES[mime] || ".jpg"
        const safeName =
          customFilename && typeof customFilename === "string" && customFilename.startsWith("prod_")
            ? path.basename(customFilename)
            : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
        const buffer = Buffer.from(base64Data, "base64")

        persistImageBuffer(safeName, mime, buffer)

        const publicUrl = `/api/uploads/${safeName}`
        return NextResponse.json({
          success: true,
          url: publicUrl,
          filename: safeName,
          size: buffer.length,
        })
      }

      return NextResponse.json({ success: false, error: "Missing dataUrl or url in JSON body" }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Unsupported Content-Type" }, { status: 415 })
  } catch (err: any) {
    console.error("Upload handler error:", err)
    return NextResponse.json({ success: false, error: err.message || "Failed to process image upload" }, { status: 500 })
  }
}
