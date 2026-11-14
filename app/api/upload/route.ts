import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { DemoDbService } from "@/lib/db/demo-sqlite"
import { authorizeStaff, hasValidOrigin } from "@/lib/coffee/auth"

export const dynamic = "force-dynamic"

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

function sanitizeUploadFilename(rawName: unknown, ext: string): string {
  if (typeof rawName === "string" && /^prod_[A-Za-z0-9_-]+$/.test(path.basename(rawName, path.extname(rawName)))) {
    return `${path.basename(rawName, path.extname(rawName))}${ext}`
  }
  return `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
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

  // 3. Persist in SQLite / in-memory pos_uploads table
  try {
    const base64 = buffer.toString("base64")
    DemoDbService.saveUpload(safeName, mimeType, base64)
  } catch {}
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 })
  }

  const auth = await authorizeStaff(request, "cashier")
  if (auth.status !== 200) {
    return NextResponse.json(
      { success: false, error: auth.status === 401 ? "Authentication required." : "Forbidden." },
      { status: auth.status }
    )
  }

  try {
    const contentType = request.headers.get("content-type") || ""

    // 1. Multipart Form Data (Device File Upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
      }

      const mimeType = (file.type || "image/jpeg").toLowerCase()
      const ext = ALLOWED_MIME_TYPES[mimeType]
      if (!ext) {
        return NextResponse.json({ success: false, error: "Unsupported image type. Allowed: JPEG, PNG, WebP, GIF." }, { status: 400 })
      }

      const safeName = sanitizeUploadFilename(file.name, ext)
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "File too large (max 5MB)." }, { status: 413 })
      }
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

        const mime = matches[1].toLowerCase()
        const ext = ALLOWED_MIME_TYPES[mime]
        if (!ext) {
          return NextResponse.json({ success: false, error: "Unsupported image type. Allowed: JPEG, PNG, WebP, GIF." }, { status: 400 })
        }

        const base64Data = matches[2]
        const safeName = sanitizeUploadFilename(customFilename, ext)
        const buffer = Buffer.from(base64Data, "base64")
        if (buffer.byteLength > 5 * 1024 * 1024) {
          return NextResponse.json({ success: false, error: "Image too large (max 5MB)." }, { status: 413 })
        }

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
