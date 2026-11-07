// scripts/verify-table-booked-sync.mjs
// End-to-end verification script for Table Booked & Tables floor synchronization

import assert from "node:assert"

const BASE_URL = "http://localhost:3005"

const norm = (s) => (s || "").toLowerCase().replace(/\btable\s*0+(\d+)\b/i, "table $1")
const findTable = (tables, name) => tables.find((t) => norm(t.name) === norm(name) || t.id.toLowerCase() === norm(name))

async function run() {
  console.log("=================================================================")
  console.log("  LAZY SUNDAY - TABLE BOOKED & TABLES SYNCHRONIZATION TEST SUITE ")
  console.log("=================================================================\n")

  // --- Baseline: check all tables ---
  console.log("[Setup] Verifying initial floor state from /api/tables...")
  const initRes = await fetch(`${BASE_URL}/api/tables`)
  assert.strictEqual(initRes.status, 200, "Expected HTTP 200 from /api/tables")
  const initData = await initRes.json()
  assert.strictEqual(initData.success, true)
  assert.strictEqual(initData.tables.length, 14, "Expected 14 tables")
  console.log("✓ Initial 14 tables verified from SQLite.")

  // Clean any active sessions or reservations on test tables (Table 2, Table 3, Table 4, Table 6)
  const prevBookings = await (await fetch(`${BASE_URL}/api/tables/bookings`)).json()
  for (const b of (prevBookings.reservations || [])) {
    await fetch(`${BASE_URL}/api/tables/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id: b.id }),
    })
  }

  for (const name of ["Table 2", "Table 3", "Table 4", "Table 6"]) {
    await fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", tableName: name }),
    })
  }

  // ============================================================================
  // ACCEPTANCE TEST 1:
  // Create a reservation in Table Booked and confirm it appears against the correct
  // table in Tables. Reschedule it to another table and verify that both tables update.
  // ============================================================================
  console.log("\n[Acceptance Test 1] Create reservation & reschedule across tables...")

  // Create booking within current hold window (arriving in 5 minutes)
  const holdTime = new Date(Date.now() + 5 * 60000).toISOString()
  const createRes = await fetch(`${BASE_URL}/api/tables/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      customer_name: "John Doe",
      phone: "+94 77 123 4567",
      party_size: 4,
      reserved_for: holdTime,
      duration_minutes: 90,
      table_name: "Table 4",
      special_requests: "Window seat preferred",
    }),
  })
  assert.strictEqual(createRes.status, 200, "Expected HTTP 200 on reservation creation")
  const createData = await createRes.json()
  assert.strictEqual(createData.success, true)
  const bookingId = createData.reservation.id
  assert(bookingId, "Expected valid reservation ID")
  console.log(`✓ Reservation created for John Doe (ID: ${bookingId}) on Table 4.`)

  // Confirm Table 4 shows Reserved in Tables floor query
  const floor1 = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t4 = findTable(floor1.tables, "Table 4")
  assert(t4, "Table 4 must exist")
  assert.strictEqual(t4.status, "reserved", "Table 4 must be marked 'reserved' within hold window")
  assert.strictEqual(t4.guestName, "John Doe", "Table 4 guest name must match John Doe")
  console.log(`✓ Table 4 accurately shows Reserved (held for John Doe).`)

  // Reschedule booking from Table 4 to Table 6
  console.log("  Rescheduling John Doe from Table 4 to Table 6...")
  const reschedRes = await fetch(`${BASE_URL}/api/tables/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reschedule",
      id: bookingId,
      table_name: "Table 6",
      reserved_for: holdTime,
      duration_minutes: 90,
    }),
  })
  assert.strictEqual(reschedRes.status, 200)
  const reschedData = await reschedRes.json()
  assert.strictEqual(reschedData.success, true)

  // Verify both tables updated: Table 4 reverted to available, Table 6 is reserved
  const floorAfterResched = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t4After = findTable(floorAfterResched.tables, "Table 4")
  const t6After = findTable(floorAfterResched.tables, "Table 6")
  assert.strictEqual(t4After.status, "available", "Table 4 must revert to 'available' after booking moved")
  assert.strictEqual(t6After.status, "reserved", "Table 6 must now be 'reserved'")
  assert.strictEqual(t6After.guestName, "John Doe", "Table 6 must show John Doe")
  console.log(`✓ Both table cards updated: Table 4 is now Available; Table 6 is Reserved.`)

  // ============================================================================
  // ACCEPTANCE TEST 2:
  // Seat the booked party from Tables. Confirm the table shows Occupied and the
  // booking reflects that the guests were seated.
  // ============================================================================
  console.log("\n[Acceptance Test 2] Seat the booked party from Tables...")

  const seatRes = await fetch(`${BASE_URL}/api/tables/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "seat",
      id: bookingId,
      guestCount: 4,
    }),
  })
  assert.strictEqual(seatRes.status, 200, "Expected HTTP 200 on seating booking")
  const seatData = await seatRes.json()
  assert.strictEqual(seatData.success, true)
  assert.strictEqual(seatData.session.table_id, t6After.id)
  console.log(`✓ Booked party seated. Active session created for Table 6.`)

  // Verify table is Occupied in floor state
  const floorAfterSeat = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t6Occupied = findTable(floorAfterSeat.tables, "Table 6")
  assert.strictEqual(t6Occupied.status, "occupied", "Table 6 must show 'occupied'")
  assert.strictEqual(t6Occupied.guestName, "John Doe")

  // Verify booking is marked seated in bookings query
  const bookingsRes = await fetch(`${BASE_URL}/api/tables/bookings`)
  const bookingsData = await bookingsRes.json()
  const seatedBooking = bookingsData.reservations.find((b) => b.id === bookingId)
  assert(seatedBooking, "Booking must exist")
  assert.strictEqual(seatedBooking.status, "seated", "Booking status must be 'seated'")
  console.log(`✓ Table 6 shows Occupied and booking status shows 'seated' in both sections.`)

  // Clean up Table 6
  await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", tableName: "Table 6" }),
  })

  // ============================================================================
  // ACCEPTANCE TEST 3:
  // Seat a walk-in, then release the table from Tables. Verify the new status
  // in a second POS session and after a page reload.
  // ============================================================================
  console.log("\n[Acceptance Test 3] Seat walk-in & release table from Tables...")

  const walkinRes = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "seat",
      tableName: "Table 2",
      guestInfo: {
        customer_name: "Walk-in Guests",
        guest_count: 2,
        notes: "No reservation",
      },
    }),
  })
  assert.strictEqual(walkinRes.status, 200)
  const walkinData = await walkinRes.json()
  assert.strictEqual(walkinData.success, true)
  console.log(`✓ Walk-in guests seated on Table 2.`)

  // Verify Table 2 is Occupied in Session 1
  const session1Floor = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t2Session1 = findTable(session1Floor.tables, "Table 2")
  assert.strictEqual(t2Session1.status, "occupied")

  // Release table from Tables workspace (guests left)
  console.log("  Releasing Table 2 after guests leave...")
  const releaseRes = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", tableName: "Table 2" }),
  })
  assert.strictEqual(releaseRes.status, 200)
  const releaseData = await releaseRes.json()
  assert.strictEqual(releaseData.success, true)
  assert.strictEqual(releaseData.status, "available")

  // Verify in a simulated second session / page reload
  const reloadFloor = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t2Reload = findTable(reloadFloor.tables, "Table 2")
  assert.strictEqual(t2Reload.status, "available", "Table 2 must be 'available' after reload")
  assert.strictEqual(t2Reload.activeSession, null, "Active session must be closed")
  console.log(`✓ Table 2 released to Available. Verified across second session and page reload.`)

  // ============================================================================
  // ACCEPTANCE TEST 4:
  // Release an occupied table that has a later reservation. Confirm the later
  // reservation remains visible and the table’s current status reflects the
  // applicable hold rules.
  // ============================================================================
  console.log("\n[Acceptance Test 4] Release occupied table with a later reservation...")

  // Create a reservation for 3 hours in the future on Table 3
  const laterTime = new Date(Date.now() + 3 * 3600000).toISOString()
  const laterRes = await fetch(`${BASE_URL}/api/tables/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      customer_name: "Sarah Later",
      phone: "+94 71 555 1234",
      party_size: 2,
      reserved_for: laterTime,
      duration_minutes: 90,
      table_name: "Table 3",
    }),
  })
  assert.strictEqual(laterRes.status, 200)
  const laterData = await laterRes.json()
  const laterBookingId = laterData.reservation.id
  console.log(`✓ Later reservation created on Table 3 for Sarah Later at ${laterTime}.`)

  // Confirm that because the reservation is in the future (>30 min), Table 3 is Available right now
  const floorBeforeSeat = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t3Before = findTable(floorBeforeSeat.tables, "Table 3")
  assert.strictEqual(t3Before.status, "available", "Table 3 must remain 'available' before hold window")
  assert(t3Before.nextBooking, "Table 3 must have nextBooking attached")
  assert.strictEqual(t3Before.nextBooking.customer_name, "Sarah Later")
  console.log(`✓ Table 3 is Available now, with later reservation visibly attached.`)

  // Now seat current afternoon walk-in on Table 3
  await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "seat",
      tableName: "Table 3",
      guestInfo: { customer_name: "Afternoon Diner", guest_count: 2 },
    }),
  })
  const floorWhileOccupied = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t3Occupied = findTable(floorWhileOccupied.tables, "Table 3")
  assert.strictEqual(t3Occupied.status, "occupied", "Table 3 must be 'occupied' while diner is seated")
  assert(t3Occupied.nextBooking, "Later reservation must still be attached during occupancy")

  // Release Table 3 after afternoon diner leaves
  console.log("  Afternoon diner leaves: releasing Table 3...")
  const releaseLaterTbl = await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", tableName: "Table 3" }),
  })
  const releaseLaterData = await releaseLaterTbl.json()
  assert.strictEqual(releaseLaterData.status, "available", "Table 3 must become 'available' for incoming walk-ins")

  // Check floor: Table 3 is available for current walk-ins, AND Sarah Later's reservation is preserved!
  const floorAfterRelease = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t3After = findTable(floorAfterRelease.tables, "Table 3")
  assert.strictEqual(t3After.status, "available", "Table 3 must be 'available'")
  assert(t3After.nextBooking, "Later reservation must remain attached")
  assert.strictEqual(t3After.nextBooking.customer_name, "Sarah Later")
  console.log(`✓ Table 3 released: Current status is Available, and future reservation remains intact!`)

  // ============================================================================
  // ACCEPTANCE TEST 5:
  // Cancel a booking, then test simultaneous seating attempts from two sessions.
  // Verify that both sessions settle on the same saved state.
  // ============================================================================
  console.log("\n[Acceptance Test 5] Cancel booking & simultaneous seating concurrency...")

  // Cancel Sarah Later's booking
  const cancelRes = await fetch(`${BASE_URL}/api/tables/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", id: laterBookingId }),
  })
  assert.strictEqual(cancelRes.status, 200)
  console.log(`✓ Sarah Later's booking successfully cancelled.`)

  // Confirm booking is cancelled and hold clears in Tables
  const floorAfterCancel = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t3Cancelled = findTable(floorAfterCancel.tables, "Table 3")
  assert.strictEqual(t3Cancelled.status, "available")
  assert.strictEqual(t3Cancelled.heldBooking, null)

  // Test simultaneous seating attempts on Table 3 from Session A and Session B
  console.log("  Executing simultaneous seating attempts on Table 3 from two sessions...")
  const [resA, resB] = await Promise.all([
    fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "seat",
        tableName: "Table 3",
        guestInfo: { customer_name: "Staff Session A", guest_count: 2 },
      }),
    }),
    fetch(`${BASE_URL}/api/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "seat",
        tableName: "Table 3",
        guestInfo: { customer_name: "Staff Session B", guest_count: 2 },
      }),
    }),
  ])

  const statusCodes = [resA.status, resB.status]
  assert(
    statusCodes.includes(200) && statusCodes.includes(409),
    `Expected one 200 OK and one 409 Conflict. Got ${statusCodes.join(", ")}`
  )
  console.log(`✓ Concurrency safely handled: Exactly one seating succeeded (200) and one was rejected (409 Conflict).`)

  // Verify that both sessions settle on the same authoritative state
  const sessionFloorFinal = await (await fetch(`${BASE_URL}/api/tables`)).json()
  const t3Final = findTable(sessionFloorFinal.tables, "Table 3")
  assert.strictEqual(t3Final.status, "occupied", "Table 3 must be 'occupied'")
  assert(t3Final.activeSession, "Must have exactly one active session")
  console.log(`✓ Both sessions settled on authoritative saved state: Table 3 is Occupied (${t3Final.guestName}).`)

  // Clean up Table 3
  await fetch(`${BASE_URL}/api/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", tableName: "Table 3" }),
  })

  console.log("\n=================================================================")
  console.log("  🎉 ALL 5 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS! 🎉")
  console.log("=================================================================\n")
}

run().catch((err) => {
  console.error("Test failure:", err)
  process.exit(1)
})
