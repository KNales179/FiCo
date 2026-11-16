import { Navigate } from 'react-router-dom'
import { isRunningInstalled } from '../features/pwa/installPrompt'
import Landing from './Landing'

/** /welcome: the front page on purpose. The installed app is the app itself, so it skips it. */
const Welcome = () => (isRunningInstalled() ? <Navigate to="/" replace /> : <Landing />)

export default Welcome
