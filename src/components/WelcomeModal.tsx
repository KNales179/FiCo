import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasSeenTutorial, markTutorialSeen } from '../features/onboarding'
import { Modal, Button } from './ui'
import { IconCompass } from './icons'

/**
 * Shown once, the first time Fico opens on a device — not forced, not
 * repeated. Skipping it (or closing it) marks it seen for good; the actual
 * walkthrough only ever shows again if someone chooses to open it later
 * from the menu ("How Fico works").
 */
const WelcomeModal = () => {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasSeenTutorial()) setShow(true)
  }, [])

  if (!show) return null

  const dismiss = () => {
    markTutorialSeen()
    setShow(false)
  }

  return (
    <Modal title="Welcome to Fico" onClose={dismiss}>
      <p className="text-sm text-muted">
        A quick look at how recording money, shopping, and bills works here —
        takes about two minutes, and you can always come back to it later
        from the menu.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={dismiss}>Skip for now</Button>
        <Button
          variant="primary"
          onClick={() => {
            markTutorialSeen()
            setShow(false)
            navigate('/tutorial')
          }}
        >
          <IconCompass size={15} />
          Take the tour
        </Button>
      </div>
    </Modal>
  )
}

export default WelcomeModal
