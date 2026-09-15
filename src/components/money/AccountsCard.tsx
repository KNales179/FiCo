import { useEffect, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useSpace } from '../../hooks/useSpace'
import {
  SUPPORTED_CURRENCIES,
  currencyName,
  formatMoney,
  parseAmountToMinor,
} from '../../domain/money'
import type { AccountType } from '../../types/models'
import { Button } from '../ui'
import { IconArchive, IconPlus, IconStar, IconTrash, IconX } from '../icons'

const ACCOUNT_TYPES: AccountType[] = [
  'CASH',
  'BANK',
  'EWALLET',
  'SAVINGS',
  'OTHER',
]

const AccountsCard = () => {
  const {
    accounts,
    totalsByCurrency,
    canEdit,
    addAccount,
    archiveAccount,
    removeAccount,
    makeDefaultAccount,
  } = useMoney()
  const { activeSpace } = useSpace()
  const spaceCurrency = activeSpace?.currency ?? 'PHP'

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('CASH')
  const [currency, setCurrency] = useState(spaceCurrency)
  const [opening, setOpening] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Follows the Finance's own currency until the person picks a different
  // one for this account — e.g. an AED account inside an otherwise-PHP
  // family space for money that arrives from abroad.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(spaceCurrency)
  }, [spaceCurrency])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const openingBalanceMinor =
      opening.trim() === '' ? 0 : parseAmountToMinor(opening, currency)
    if (openingBalanceMinor === null) {
      setError('Opening balance is not a valid amount')
      return
    }

    setBusy(true)
    try {
      await addAccount({ name, type, currency, openingBalanceMinor })
      setName('')
      setOpening('')
      setType('CASH')
      setCurrency(spaceCurrency)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Accounts</h2>
        {canEdit && (
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? <IconX size={14} /> : <IconPlus size={14} />}
            {open ? 'Cancel' : 'Account'}
          </Button>
        )}
      </div>

      {accounts.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          No accounts yet. {canEdit && 'Add one to start recording money.'}
        </p>
      )}

      <ul className="mt-3 divide-y divide-line">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <span className="text-sm">
              {account.name}
              <span className="ml-2 text-xs text-muted">
                {account.type.toLowerCase()}
                {account.isDefault && ' · default'}
                {account.status === 'ARCHIVED' && ' · archived'}
              </span>
            </span>

            <span className="flex items-center gap-3">
              <span
                className={`tabular-nums ${
                  account.balanceMinor < 0 ? 'text-danger' : 'text-ink'
                }`}
              >
                {formatMoney(account.balanceMinor, account.currency)}
              </span>
              {canEdit &&
                account.status === 'ACTIVE' &&
                !account.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Make default"
                    title="Make default"
                    onClick={() => void makeDefaultAccount(account.id)}
                  >
                    <IconStar size={14} />
                  </Button>
                )}
              {canEdit && account.status === 'ACTIVE' && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Archive"
                  title="Archive"
                  onClick={() => void archiveAccount(account.id)}
                >
                  <IconArchive size={14} />
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Delete"
                  title="Delete"
                  className="hover:text-danger"
                  onClick={() => void removeAccount(account.id).catch(() => {})}
                >
                  <IconTrash size={14} />
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {Object.entries(totalsByCurrency).length > 0 && (
        <div className="mt-3 border-t border-line pt-2 text-right text-sm font-semibold tabular-nums">
          {Object.entries(totalsByCurrency).map(([currency, total]) => (
            <div key={currency}>Total {formatMoney(total, currency)}</div>
          ))}
        </div>
      )}

      {open && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-2 border-t border-line pt-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name"
            required
            maxLength={60}
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="select w-auto"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="select w-auto"
              title={currencyName(currency)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c} title={currencyName(c)}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              inputMode="decimal"
              placeholder="Opening balance"
              className="input flex-1"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add account'}
          </Button>
        </form>
      )}
    </section>
  )
}

export default AccountsCard
