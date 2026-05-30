export interface MonthlyDiscountMap {
    january: number
    february: number
    march: number
    april: number
    may: number
    june: number
    july: number
    august: number
    september: number
    october: number
    november: number
    december: number
}

export interface DiscountSettings {
    monthlyDiscounts: MonthlyDiscountMap
    highestOrderThreshold: number
    highestOrderDiscountPercent: number
    cumulativeSpendThreshold: number
    cumulativeSpendDiscountPercent: number
    largeOrderThreshold: number
    largeOrderDiscountPercent: number
    maxTotalDiscountPercent: number
}

export interface AppliedDiscount {
    key: string
    label: string
    percent: number
    amount: number
}

export interface DiscountComputationResult {
    subtotal: number
    discounts: AppliedDiscount[]
    totalDiscountAmount: number
    totalDiscountPercent: number
    payableAmount: number
}

export const defaultDiscountSettings: DiscountSettings = {
    monthlyDiscounts: {
        january: 0,
        february: 0,
        march: 0,
        april: 0,
        may: 0,
        june: 0,
        july: 0,
        august: 0,
        september: 0,
        october: 0,
        november: 0,
        december: 0
    },
    highestOrderThreshold: 10000,
    highestOrderDiscountPercent: 5,
    cumulativeSpendThreshold: 50000,
    cumulativeSpendDiscountPercent: 4,
    largeOrderThreshold: 5000,
    largeOrderDiscountPercent: 3,
    maxTotalDiscountPercent: 20
}

const monthKeyByIndex: Array<keyof MonthlyDiscountMap> = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
]

const normalizePercent = (value: number) => {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
}

const normalizeAmount = (value: number) => {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, value)
}

const mergeDiscountSettings = (raw: Partial<DiscountSettings> | null | undefined): DiscountSettings => ({
    monthlyDiscounts: {
        january: normalizePercent(raw?.monthlyDiscounts?.january ?? defaultDiscountSettings.monthlyDiscounts.january),
        february: normalizePercent(raw?.monthlyDiscounts?.february ?? defaultDiscountSettings.monthlyDiscounts.february),
        march: normalizePercent(raw?.monthlyDiscounts?.march ?? defaultDiscountSettings.monthlyDiscounts.march),
        april: normalizePercent(raw?.monthlyDiscounts?.april ?? defaultDiscountSettings.monthlyDiscounts.april),
        may: normalizePercent(raw?.monthlyDiscounts?.may ?? defaultDiscountSettings.monthlyDiscounts.may),
        june: normalizePercent(raw?.monthlyDiscounts?.june ?? defaultDiscountSettings.monthlyDiscounts.june),
        july: normalizePercent(raw?.monthlyDiscounts?.july ?? defaultDiscountSettings.monthlyDiscounts.july),
        august: normalizePercent(raw?.monthlyDiscounts?.august ?? defaultDiscountSettings.monthlyDiscounts.august),
        september: normalizePercent(raw?.monthlyDiscounts?.september ?? defaultDiscountSettings.monthlyDiscounts.september),
        october: normalizePercent(raw?.monthlyDiscounts?.october ?? defaultDiscountSettings.monthlyDiscounts.october),
        november: normalizePercent(raw?.monthlyDiscounts?.november ?? defaultDiscountSettings.monthlyDiscounts.november),
        december: normalizePercent(raw?.monthlyDiscounts?.december ?? defaultDiscountSettings.monthlyDiscounts.december)
    },
    highestOrderThreshold: normalizeAmount(raw?.highestOrderThreshold ?? defaultDiscountSettings.highestOrderThreshold),
    highestOrderDiscountPercent: normalizePercent(raw?.highestOrderDiscountPercent ?? defaultDiscountSettings.highestOrderDiscountPercent),
    cumulativeSpendThreshold: normalizeAmount(raw?.cumulativeSpendThreshold ?? defaultDiscountSettings.cumulativeSpendThreshold),
    cumulativeSpendDiscountPercent: normalizePercent(raw?.cumulativeSpendDiscountPercent ?? defaultDiscountSettings.cumulativeSpendDiscountPercent),
    largeOrderThreshold: normalizeAmount(raw?.largeOrderThreshold ?? defaultDiscountSettings.largeOrderThreshold),
    largeOrderDiscountPercent: normalizePercent(raw?.largeOrderDiscountPercent ?? defaultDiscountSettings.largeOrderDiscountPercent),
    maxTotalDiscountPercent: normalizePercent(raw?.maxTotalDiscountPercent ?? defaultDiscountSettings.maxTotalDiscountPercent)
})

export const fetchDiscountSettings = async (apiUrl: (endpoint: string) => string): Promise<DiscountSettings> => {
    try {
        const response = await fetch(apiUrl('/discount-settings'))
        if (!response.ok) throw new Error('Failed to load discount settings')
        const data = await response.json()
        return mergeDiscountSettings(data)
    } catch {
        return defaultDiscountSettings
    }
}

export interface DiscountComputationInput {
    subtotal: number
    orderDate?: string
    customerOrderTotals: number[]
    customerPaidOrderTotals: number[]
    settings: DiscountSettings
}

export const computeDiscounts = ({
    subtotal,
    orderDate,
    customerOrderTotals,
    customerPaidOrderTotals,
    settings
}: DiscountComputationInput): DiscountComputationResult => {
    const safeSubtotal = normalizeAmount(subtotal)

    if (safeSubtotal <= 0) {
        return {
            subtotal: 0,
            discounts: [],
            totalDiscountAmount: 0,
            totalDiscountPercent: 0,
            payableAmount: 0
        }
    }

    const discounts: AppliedDiscount[] = []

    const date = orderDate ? new Date(orderDate) : new Date()
    const monthKey = monthKeyByIndex[date.getMonth()]
    const monthlyPercent = settings.monthlyDiscounts[monthKey]
    if (monthlyPercent > 0) {
        discounts.push({
            key: 'monthly',
            label: `${monthKey.charAt(0).toUpperCase()}${monthKey.slice(1)} Offer`,
            percent: monthlyPercent,
            amount: (safeSubtotal * monthlyPercent) / 100
        })
    }

    const highestOrder = customerOrderTotals.length > 0 ? Math.max(...customerOrderTotals) : 0
    if (highestOrder >= settings.highestOrderThreshold && settings.highestOrderDiscountPercent > 0) {
        discounts.push({
            key: 'highest-order',
            label: `High Value Customer (Highest Order >= Rs ${settings.highestOrderThreshold.toFixed(0)})`,
            percent: settings.highestOrderDiscountPercent,
            amount: (safeSubtotal * settings.highestOrderDiscountPercent) / 100
        })
    }

    const totalPaidSpend = customerPaidOrderTotals.reduce((sum, item) => sum + normalizeAmount(item), 0)
    if (totalPaidSpend >= settings.cumulativeSpendThreshold && settings.cumulativeSpendDiscountPercent > 0) {
        discounts.push({
            key: 'cumulative-spend',
            label: `Loyalty Spend (Paid Collection >= Rs ${settings.cumulativeSpendThreshold.toFixed(0)})`,
            percent: settings.cumulativeSpendDiscountPercent,
            amount: (safeSubtotal * settings.cumulativeSpendDiscountPercent) / 100
        })
    }

    if (safeSubtotal >= settings.largeOrderThreshold && settings.largeOrderDiscountPercent > 0) {
        discounts.push({
            key: 'large-order',
            label: `Large Bill Offer (Order >= Rs ${settings.largeOrderThreshold.toFixed(0)})`,
            percent: settings.largeOrderDiscountPercent,
            amount: (safeSubtotal * settings.largeOrderDiscountPercent) / 100
        })
    }

    const grossDiscountPercent = discounts.reduce((sum, item) => sum + item.percent, 0)
    const clampedDiscountPercent = Math.min(grossDiscountPercent, settings.maxTotalDiscountPercent)
    const capFactor = grossDiscountPercent > 0 ? clampedDiscountPercent / grossDiscountPercent : 1

    const normalizedDiscounts = discounts.map(item => ({
        ...item,
        amount: item.amount * capFactor
    }))

    const totalDiscountAmount = normalizedDiscounts.reduce((sum, item) => sum + item.amount, 0)
    const payableAmount = Math.max(0, safeSubtotal - totalDiscountAmount)

    return {
        subtotal: safeSubtotal,
        discounts: normalizedDiscounts,
        totalDiscountAmount,
        totalDiscountPercent: clampedDiscountPercent,
        payableAmount
    }
}