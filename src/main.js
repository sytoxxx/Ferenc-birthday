import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/intro.css'
import './styles/gift.css'
import { startKeyboardInsets } from './lib/keyboard.js'
import { startApp } from './app/app.js'

startKeyboardInsets()

const root = document.querySelector('#app')

if (!root) {
  throw new Error('Missing application root')
}

startApp(root)
