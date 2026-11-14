import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-dynamic"

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
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
      const safeName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      try {
        const uploadsDir = path.join(process.cwd(), "public", "uploads")
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        const targetPath = path.join(uploadsDir, safeName)
        fs.writeFileSync(targetPath, buffer)

        const publicUrl = `/uploads/${safeName}`
        return NextResponse.json({
          success: true,
          url: publicUrl,
          filename: safeName,
          size: buffer.length,
        })
      } catch (writeErr) {
        // Fallback for serverless read-only environments (e.g. Vercel)
        console.warn("Read-only filesystem detected, encoding as dataUrl:", writeErr)
        const base64 = buffer.toString("base64")
        const dataUrl = `data:${mimeType};base64,${base64}`
        return NextResponse.json({
          success: true,
          url: dataUrl,
          filename: safeName,
          size: buffer.length,
        })
      }
    }

    // 2. JSON Payload (Base64 dataUrl or direct image URL)
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const { dataUrl, url } = body

      if (url && typeof url === "string") {
        return NextResponse.json({ success: true, url: url.trim() })
      }

      if (dataUrl && typeof dataUrl === "string") {
        const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (!matches || matches.length !== 3) {
          return NextResponse.json({ success: false, error: "Invalid base64 data URL" }, { status: 400 })
        }

        const mime = matches[1]
        const base64Data = matches[2]
        const ext = ALLOWED_MIME_TYPES[mime] || ".jpg"
        const safeName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`

        try {
          const uploadsDir = path.join(process.cwd(), "public", "uploads")
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true })
          }
          const targetPath = path.join(uploadsDir, safeName)
          const buffer = Buffer.from(base64Data, "base64")
          fs.writeFileSync(targetPath, buffer)

          const publicUrl = `/uploads/${safeName}`
          return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: safeName,
            size: buffer.length,
          })
        } catch {
          // If filesystem is read-only (e.g. Vercel), return the dataUrl directly
          return NextResponse.json({
            success: true,
            url: dataUrl,
            filename: safeName,
            size: base64Data.length,
          })
        }
      }

      return NextResponse.json({ success: false, error: "Missing dataUrl or url in JSON body" }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Unsupported Content-Type" }, { status: 415 })
  } catch (err: any) {
    console.error("Upload handler error:", err)
    return NextResponse.json({ success: false, error: err.message || "Failed to process image upload" }, { status: 500 })
  }
}
