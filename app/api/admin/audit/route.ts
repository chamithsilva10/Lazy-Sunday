import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeStaff } from "@/lib/coffee/auth"
import { readSecurityAudit, writeSecurityAudit } from "@/lib/coffee/security"

const filtersSchema = z.object({
  action: z.string().max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await authorizeStaff(request, "admin")
  if (auth.status !== 200 || !auth.identity) {
    return NextResponse.json({ error: auth.status === 401 ? "Authentication required." : "Forbidden." }, { status: auth.status })
  }

  const parsed = filtersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid audit filters." }, { status: 400 })

  try {
    const result = await readSecurityAudit(parsed.data)
    await writeSecurityAudit(request, "audit_log_viewed", auth.identity.userId, null, {
      action: parsed.data.action || null,
      offset: parsed.data.offset,
    })
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Audit log read failed", error)
    return NextResponse.json({ error: "Unable to load audit logs." }, { status: 500 })
  }
}