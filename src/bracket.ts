export type ReductionRoundPlan = {
  targetSize: number
  pairMatchCount: number
  tripleMatchCount: number
}

export function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0
}

function canReachPowerOfTwoWithoutByes(
  itemCount: number,
  memo = new Map<number, boolean>(),
): boolean {
  if (isPowerOfTwo(itemCount)) {
    return true
  }

  const memoized = memo.get(itemCount)

  if (memoized !== undefined) {
    return memoized
  }

  const minimumWinners = Math.ceil(itemCount / 3)
  const maximumWinners = Math.floor(itemCount / 2)

  for (let targetSize = maximumWinners; targetSize >= minimumWinners; targetSize -= 1) {
    if (canReachPowerOfTwoWithoutByes(targetSize, memo)) {
      memo.set(itemCount, true)
      return true
    }
  }

  memo.set(itemCount, false)
  return false
}

export function getReductionRoundPlan(itemCount: number) {
  if (itemCount < 2) {
    return null
  }

  if (isPowerOfTwo(itemCount)) {
    return null
  }

  const minimumWinners = Math.ceil(itemCount / 3)
  const maximumWinners = Math.floor(itemCount / 2)
  const reachablePlans: ReductionRoundPlan[] = []

  for (let targetSize = maximumWinners; targetSize >= minimumWinners; targetSize -= 1) {
    if (!canReachPowerOfTwoWithoutByes(targetSize)) {
      continue
    }

    const tripleMatchCount = itemCount - 2 * targetSize
    const pairMatchCount = targetSize - tripleMatchCount

    reachablePlans.push({
      targetSize,
      pairMatchCount,
      tripleMatchCount,
    })
  }

  return reachablePlans.sort((firstPlan, secondPlan) => {
    const firstIsPowerOfTwo = isPowerOfTwo(firstPlan.targetSize)
    const secondIsPowerOfTwo = isPowerOfTwo(secondPlan.targetSize)

    if (firstIsPowerOfTwo !== secondIsPowerOfTwo) {
      return firstIsPowerOfTwo ? -1 : 1
    }

    if (firstPlan.tripleMatchCount !== secondPlan.tripleMatchCount) {
      return firstPlan.tripleMatchCount - secondPlan.tripleMatchCount
    }

    return secondPlan.targetSize - firstPlan.targetSize
  })[0]
}

export function getReductionRoundPlans(itemCount: number) {
  const plans: ReductionRoundPlan[] = []
  let currentItemCount = itemCount

  while (currentItemCount >= 2 && !isPowerOfTwo(currentItemCount)) {
    const plan = getReductionRoundPlan(currentItemCount)

    if (!plan) {
      break
    }

    plans.push(plan)
    currentItemCount = plan.targetSize
  }

  return plans
}
