import { useEffect, useState, type FormEvent } from 'react'
import RollingNumber from '../RollingNumber'
import { celebrate } from '../../features/ui/celebrate'
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
import {
  IconArchive,
  IconPlus,
  IconRotateCcw,
  IconStar,
  IconTrash,
  IconWallet,
  IconX,
} from '../icons'
import CollapsibleCard from '../CollapsibleCard'

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
    unarchiveAccount,
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
  const [showArchived, setShowArchived] = useState(false)

  // Archived accounts keep their balance and history but can't be picked
  // for new records, so they live in their own list below — restoring one
  // makes it selectable in Spent / Received again.
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE')
  const archivedAccounts = accounts.filter((a) => a.status === 'ARCHIVED')

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
      celebrate('dash.accounts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CollapsibleCard
      id="dash.accounts"
      title="Accounts"
      icon={IconWallet}
      dataTour="accounts"
      subtitle={`${activeAccounts.length} account${activeAccounts.length === 1 ? '' : 's'}`}
      actions={
        canEdit && (
          <Button size="sm" data-tour="accounts-add" onClick={() => setOpen((v) => !v)}>
            {open ? <IconX size={14} /> : <IconPlus size={14} />}
            {open ? 'Cancel' : 'Account'}
          </Button>
        )
      }
    >

      {activeAccounts.length === 0 && (
        <p className="text-sm text-muted">
          {archivedAccounts.length > 0
            ? 'No active accounts — restore one from the archive below, or add a new one.'
            : `No accounts yet. ${canEdit ? 'Add one to start recording money.' : ''}`}
        </p>
      )}

      <ul className="-mt-2 divide-y divide-line">
        {activeAccounts.map((account, index) => (
          <li
            key={account.id}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            {/* Name and type on the left, amount and buttons pushed to the
                right — always this shape, never wrapping under each other. */}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{account.name}</span>
              <span className="block text-xs text-muted">
                {account.type.toLowerCase()}
                {account.isDefault && ' · default'}
              </span>
            </span>

            <span
              className="flex shrink-0 items-center gap-1"
              data-tour={index === 0 ? 'account-row' : undefined}
            >
              <span
                className={`mr-2 tabular-nums ${
                  account.balanceMinor < 0 ? 'text-danger' : 'text-ink'
                }`}
              >
                <RollingNumber value={formatMoney(account.balanceMinor, account.currency)} />
              </span>
              {canEdit &&
                (account.isDefault ? (
                  // Keeps the buttons lined up in columns across rows.
                  <span className="w-7" aria-hidden="true" />
                ) : (
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
                ))}
              {canEdit && (
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

      {archivedAccounts.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <IconArchive size={13} />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAccounts.length})
          </button>
          {showArchived && (
            <ul className="mt-2 divide-y divide-line">
              {archivedAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-muted">{account.name}</span>
                    <span className="block text-xs text-muted">
                      {account.type.toLowerCase()} · archived
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="mr-2 tabular-nums text-muted">
                      <RollingNumber value={formatMoney(account.balanceMinor, account.currency)} />
                    </span>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => void unarchiveAccount(account.id)}
                      >
                        <IconRotateCcw size={14} />
                        Restore
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
                        onClick={() =>
                          void removeAccount(account.id).catch(() => {})
                        }
                      >
                        <IconTrash size={14} />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
    </CollapsibleCard>
  )
}

export default AccountsCard
