"use client"

import { useEffect, useState } from "react"
import { SharedPosService, type SharedTable } from "@/lib/shared-pos-service"

/** Live floor state (tables + occupancy) shared across every screen and terminal. */
export function useSharedTables(): SharedTable[] {
  const [tables, setTables] = useState<SharedTable[]>(() => SharedPosService.getTables())
  useEffect(() => SharedPosService.subscribe(setTables), [])
  return tables
}
