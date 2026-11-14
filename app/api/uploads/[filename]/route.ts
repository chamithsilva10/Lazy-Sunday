import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { DemoDbService } from "@/lib/db/demo-sqlite"

export const dynamic = "force-dynamic"

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const safeName = path.basename(filename)
    const ext = path.extname(safeName).toLowerCase()
    const mime = MIME_MAP[ext] || "image/jpeg"

    // 1. Check local public/uploads directory (bundled or locally saved)
    const publicPath = path.join(process.cwd(), "public", "uploads", safeName)
    if (fs.existsSync(publicPath)) {
      const data = fs.readFileSync(publicPath)
      return new NextResponse(data, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }

    // 2. Check /tmp/uploads directory (serverless container /tmp)
    const tmpPath = path.join("/tmp", "uploads", safeName)
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath)
      return new NextResponse(data, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }

    // 3. Check SQLite pos_uploads table
    const record = DemoDbService.getUpload(safeName)
    if (record && record.data_base64) {
      const buf = Buffer.from(record.data_base64, "base64")
      return new NextResponse(buf, {
        headers: {
          "Content-Type": record.mime_type || mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }

    return new NextResponse("Image not found", { status: 404 })
  } catch (err: any) {
    console.error("GET /api/uploads error:", err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
