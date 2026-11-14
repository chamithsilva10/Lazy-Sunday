/**
 * Client-Side Image Compression Utility
 * Resizes large device/camera photos to a compact web format (e.g. 480x480 max).
 * Prevents HTTP 413 (Content Too Large) errors on Vercel and keeps localStorage within quotas.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 480,
  quality = 0.8
): Promise<{ dataUrl: string; blob: Blob }> {
  // If it's already an SVG or not an image, return as-is
  if (file.type === "image/svg+xml" || !file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ dataUrl: (reader.result as string) || "/placeholder.svg", blob: file })
      reader.onerror = () => resolve({ dataUrl: "/placeholder.svg", blob: file })
      reader.readAsDataURL(file)
    })
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => {
      resolve({ dataUrl: "/placeholder.svg", blob: file })
    }
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => {
        resolve({ dataUrl: (reader.result as string) || "/placeholder.svg", blob: file })
      }
      img.onload = () => {
        try {
          let { width, height } = img
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, width)
          canvas.height = Math.max(1, height)
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            resolve({ dataUrl: (reader.result as string) || "/placeholder.svg", blob: file })
            return
          }

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"
          ctx.drawImage(img, 0, 0, width, height)

          // Prefer WebP, fallback to JPEG
          let dataUrl = canvas.toDataURL("image/webp", quality)
          if (!dataUrl || !dataUrl.startsWith("data:image/webp") || dataUrl.length > 250_000) {
            dataUrl = canvas.toDataURL("image/jpeg", quality)
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ dataUrl, blob })
              } else {
                resolve({ dataUrl, blob: file })
              }
            },
            "image/jpeg",
            quality
          )
        } catch {
          resolve({ dataUrl: (reader.result as string) || "/placeholder.svg", blob: file })
        }
      }
      img.src = (reader.result as string) || ""
    }
    reader.readAsDataURL(file)
  })
}
