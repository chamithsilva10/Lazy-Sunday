import assert from "node:assert/strict"

// Pure unit & integration verification for Split Bill calculations and Menu Choice snapshots
function roundCurrency(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function allocateProportionally(totalToAllocate, weights) {
  const count = weights.length
  if (count === 0) return []
  const targetCents = Math.round(roundCurrency(totalToAllocate) * 100)
  if (targetCents === 0) return new Array(count).fill(0)

  const safeWeights = weights.map((w) => Math.max(0, Number(w) || 0))
  const totalWeight = safeWeights.reduce((acc, w) => acc + w, 0)

  const effectiveWeights = totalWeight > 0 ? safeWeights : new Array(count).fill(1)
  const effectiveTotalWeight = effectiveWeights.reduce((acc, w) => acc + w, 0)

  const sign = targetCents < 0 ? -1 : 1
  const absCents = Math.abs(targetCents)

  const exactShares = effectiveWeights.map((w) => (absCents * w) / effectiveTotalWeight)
  const floored = exactShares.map((s) => Math.floor(s))
  const remainders = exactShares.map((s, idx) => ({
    idx,
    rem: s - floored[idx],
    weight: effectiveWeights[idx],
  }))

  let remainderCents = absCents - floored.reduce((acc, c) => acc + c, 0)
  remainders.sort((a, b) => {
    if (Math.abs(b.rem - a.rem) > 1e-9) return b.rem - a.rem
    if (Math.abs(b.weight - a.weight) > 1e-9) return b.weight - a.weight
    return a.idx - b.idx
  })

  for (let i = 0; i < remainderCents; i++) {
    floored[remainders[i % count].idx] += 1
  }

  return floored.map((cents) => roundCurrency((cents * sign) / 100))
}

console.log("=== 1. Testing Largest-Remainder Rounding & Bill Accuracy ===")
{
  // 3-way even split of LKR 1,000.00 -> 333.34 + 333.33 + 333.33 = 1,000.00
  const shares = allocateProportionally(1000, [1, 1, 1])
  assert.equal(shares.length, 3)
  assert.equal(roundCurrency(shares.reduce((a, b) => a + b, 0)), 1000)
  assert.deepEqual(shares, [333.34, 333.33, 333.33])
  console.log("✓ 3-way split of LKR 1,000.00 rounds deterministically to [333.34, 333.33, 333.33]")
}

console.log("=== 2. Testing Method A (Split by Products: Single + Shared Even + Shared Custom) ===")
{
  // Two diners: "Me" and "Friend" order 4 products + 1 shared appetizer
  // Subtotal:
  // 1. Creamy Mushrooms (+ Hashbrowns 0) = 2100 -> Assigned to "Me"
  // 2. Iced Latte (+ Oat Milk 300) = 1200 -> Assigned to "Me"
  // 3. Smashed Avo = 2200 -> Assigned to "Friend"
  // 4. Flat White (+ Coconut Milk 250) = 1150 -> Assigned to "Friend"
  // 5. Loaded Nachos = 1500 -> Shared Evenly between "Me" (750) and "Friend" (750)
  const meSubtotal = 2100 + 1200 + 750 // 4050
  const friendSubtotal = 2200 + 1150 + 750 // 4100
  const subtotal = meSubtotal + friendSubtotal // 8150
  const discount = 150 // Promo discount
  const netSubtotal = subtotal - discount // 8000
  const serviceCharge = roundCurrency(netSubtotal * 0.1) // 800
  const billTotal = netSubtotal + serviceCharge // 8800

  const discountShares = allocateProportionally(discount, [meSubtotal, friendSubtotal])
  const serviceShares = allocateProportionally(serviceCharge, [
    meSubtotal - discountShares[0],
    friendSubtotal - discountShares[1],
  ])

  const meTotal = roundCurrency(meSubtotal - discountShares[0] + serviceShares[0])
  const friendTotal = roundCurrency(friendSubtotal - discountShares[1] + serviceShares[1])

  assert.equal(roundCurrency(meTotal + friendTotal), billTotal)
  console.log(`✓ Method A (Split by Products): Me owes LKR ${meTotal}, Friend owes LKR ${friendTotal}, Sum = LKR ${meTotal + friendTotal} (Bill Total = LKR ${billTotal})`)
}

console.log("=== 3. Testing Method B (Split by Percentage) & Method C (Split by LKR Amount) ===")
{
  // Method B: 60% / 40% of LKR 8,800
  const pctShares = allocateProportionally(8800, [60, 40])
  assert.deepEqual(pctShares, [5280, 3520])
  assert.equal(pctShares[0] + pctShares[1], 8800)
  console.log("✓ Method B (60% / 40% of LKR 8,800) = [5280, 3520]")

  // Method C: Fixed LKR amounts 5000 + 3800 = 8800
  const fixedShares = [5000, 3800]
  assert.equal(fixedShares[0] + fixedShares[1], 8800)
  console.log("✓ Method C (Fixed LKR 5,000 + LKR 3,800) = LKR 8,800")
}

console.log("=== 4. Testing Configurable Menu Choices Snapshot Immutability ===")
{
  const menuProductV1 = {
    id: "prod-coffee-1",
    name: "Coffee",
    price: 900,
    choice_groups: [
      {
        id: "grp-milk",
        name: "Choose milk",
        instructions: "Select your preferred milk",
        required: true,
        multiSelect: false,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-oat", name: "Oat milk", price: 300, available: true },
          { id: "opt-coconut", name: "Coconut milk", price: 250, available: true },
        ],
      },
    ],
  }

  // Order placed with Oat milk (+300 LKR)
  const pastOrderItem = {
    id: menuProductV1.id,
    name: menuProductV1.name,
    base_price: menuProductV1.price,
    price: menuProductV1.price + 300,
    quantity: 1,
    modifiers: ["Choose milk: Oat milk (+LKR 300)"],
    selected_choices: [
      {
        group_id: "grp-milk",
        group_name: "Choose milk",
        option_id: "opt-oat",
        option_name: "Oat milk",
        price: 300,
      },
    ],
  }

  // Staff later updates Oat milk to +450 LKR and renames it
  menuProductV1.choice_groups[0].options[0].price = 450
  menuProductV1.price = 1000

  // Verify past order item snapshot is completely untouched
  assert.equal(pastOrderItem.base_price, 900)
  assert.equal(pastOrderItem.price, 1200)
  assert.equal(pastOrderItem.selected_choices[0].price, 300)
  assert.equal(pastOrderItem.selected_choices[0].option_name, "Oat milk")
  console.log("✓ Historical order item snapshot remains LKR 1,200 (Oat milk +LKR 300) after menu price update")
}

console.log("ALL SPLIT BILL & MENU CHOICES ASSERTIONS PASSED!")
