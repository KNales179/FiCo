import { describe, expect, it } from 'vitest'
import {
  birthdayBudgetNudge,
  birthdayGreeting,
  birthdayInYear,
  daysUntil,
  isBirthdayToday,
  nextBirthday,
  ordinal,
  paydayInMonth,
  paydayRightBefore,
  suggestTreatMinor,
} from '.'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('birthdays', () => {
  it('finds the next birthday, today included', () => {
    expect(nextBirthday({ month: 3, day: 14 }, d(2026, 3, 14))).toEqual(d(2026, 3, 14))
    expect(nextBirthday({ month: 3, day: 14 }, d(2026, 3, 15))).toEqual(d(2027, 3, 14))
    expect(isBirthdayToday({ month: 11, day: 13 }, d(2026, 11, 13))).toBe(true)
  })

  it('celebrates Feb 29 on Feb 28 in a non-leap year', () => {
    expect(birthdayInYear({ month: 2, day: 29 }, 2027)).toEqual(d(2027, 2, 28))
    expect(birthdayInYear({ month: 2, day: 29 }, 2028)).toEqual(d(2028, 2, 29))
  })

  it('counts days across a year end', () => {
    expect(daysUntil(nextBirthday({ month: 1, day: 2 }, d(2026, 12, 30)), d(2026, 12, 30))).toBe(3)
  })

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st',
    ])
  })
})

describe('paydays', () => {
  it('treats 31 as the last day of any month', () => {
    expect(paydayInMonth(31, 2026, 2)).toEqual(d(2026, 2, 28))
    expect(paydayInMonth(31, 2026, 4)).toEqual(d(2026, 4, 30))
  })

  it('finds the payday just before a date, even in the previous month', () => {
    expect(paydayRightBefore([15, 31], d(2026, 12, 20))).toEqual(d(2026, 12, 15))
    expect(paydayRightBefore([15, 31], d(2026, 12, 3))).toEqual(d(2026, 11, 30))
    expect(paydayRightBefore([15], d(2026, 12, 30))).toBeNull()
  })
})

describe('budget nudge', () => {
  const today = d(2026, 11, 13)

  it('appears only for the month the birthday is in, and not once it has passed', () => {
    const base = { birthday: { month: 12, day: 18 }, name: 'Ana', paydays: [], today }
    expect(birthdayBudgetNudge({ ...base, period: '2026-12' })?.title).toBe("It's your birthday next month, Ana!")
    expect(birthdayBudgetNudge({ ...base, period: '2027-01' })).toBeNull()
    expect(birthdayBudgetNudge({ ...base, birthday: { month: 11, day: 2 }, period: '2026-11' })).toBeNull()
  })

  it('uses the age and a payday when it knows them', () => {
    const n = birthdayBudgetNudge({
      birthday: { month: 12, day: 18, year: 2000 },
      name: 'Ana',
      paydays: [15, 31],
      period: '2026-12',
      today,
    })
    expect(n?.title).toBe('Ana, you turn 26 next month!')
    expect(n?.paydayNote).toContain('15th')
  })

  it('suggests a modest, rounded treat', () => {
    expect(suggestTreatMinor(0)).toBe(100_000)
    expect(suggestTreatMinor(2_500_000)).toBe(130_000) // 5% of 25,000 = 1,250 → 1,300
    expect(suggestTreatMinor(6_000_000)).toBe(300_000) // 3,000
    expect(suggestTreatMinor(500_000)).toBe(50_000) // floor of 500
  })
})

describe('greeting', () => {
  it('includes the age only when a year is known', () => {
    expect(birthdayGreeting({ birthday: { month: 11, day: 13, year: 1999 }, name: 'Ben', today: d(2026, 11, 13) }).title)
      .toBe('Happy 27th birthday, Ben!')
    expect(birthdayGreeting({ birthday: { month: 11, day: 13 }, name: 'Ben', today: d(2026, 11, 13) }).title)
      .toBe('Happy birthday, Ben!')
  })
})
