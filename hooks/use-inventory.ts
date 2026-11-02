"use client"
import { useCallback, useEffect, useState } from "react"
import { inventoryApi } from "@/lib/inventory/api"
import type { Ingredient, Purchase, StockMovement } from "@/lib/inventory/types"

export function useIngredients() { const [data, setData] = useState<Ingredient[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const refetch = useCallback(async () => { setLoading(true); try { setData(await inventoryApi.ingredients()); setError(null) } catch (e) { setError(e instanceof Error ? e.message : "Could not load ingredients") } finally { setLoading(false) } }, []); useEffect(() => { void refetch() }, [refetch]); return { data, loading, error, refetch } }
export function usePurchases() { const [data, setData] = useState<Purchase[]>([]); const [loading, setLoading] = useState(true); const refetch = useCallback(async () => { setLoading(true); try { setData(await inventoryApi.purchases()) } finally { setLoading(false) } }, []); useEffect(() => { void refetch() }, [refetch]); return { data, loading, refetch } }
export function useStockMovements(ingredientId?: string) { const [data, setData] = useState<StockMovement[]>([]); const [loading, setLoading] = useState(false); const refetch = useCallback(async () => { if (!ingredientId) return; setLoading(true); try { setData(await inventoryApi.movements(ingredientId)) } finally { setLoading(false) } }, [ingredientId]); useEffect(() => { void refetch() }, [refetch]); return { data, loading, refetch } }
export function useInventoryRealtime(refetch: () => Promise<unknown>) { useEffect(() => { const timer = window.setInterval(() => void refetch(), 10000); return () => window.clearInterval(timer) }, [refetch]) }
