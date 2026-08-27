import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { getOwnerAuthState, OWNER_AUTH_STATUS, verifyOwnerGateAnswer } from '../app/owner-auth.js'
import { buildOwnerParticipant } from '../app/participant.js'
import { announce, createLiveRegion } from '../lib/errors.js'
import { createButton } from '../ui/button.js'

function errorKey(code) {
  if (code === 'empty') return 'gate.empty'
  return 'gate.errorWrong'
}

export function renderOwner({ i18n, session, router }) {
  if (getOwnerAuthState().status === OWNER_AUTH_STATUS.authenticated) {
    router.replace(ROUTES.gift)
    return el('section', { className: 'screen screen--owner' })
  }

  const errorRegion = createLiveRegion({ polite: false })
  errorRegion.classList.add('field-error')
  errorRegion.id = 'owner-gate-error'

  const input = el('input', {
    id: 'owner-gate-answer',
    className: 'field__input',
    type: 'text',
    name: 'answer',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    enterKeyHint: 'go',
    spellcheck: false,
    'aria-labelledby': 'owner-gate-question',
    'aria-describedby': 'owner-gate-lead owner-gate-error',
  })

  const setError = (message) => {
    errorRegion.textContent = message
    input.setAttribute('aria-invalid', message ? 'true' : 'false')
    announce(errorRegion, message)
  }

  const submitButton = createButton({
    label: i18n.t('gate.submit'),
    type: 'submit',
    variant: 'primary',
  })

  const onSubmit = (event) => {
    event.preventDefault()
    event.stopPropagation()

    setError('')
    const result = verifyOwnerGateAnswer(input.value)
    if (!result.ok) {
      setError(i18n.t(errorKey(result.code)))
      input.focus()
      input.select()
      return
    }

    session.becomeOwner(buildOwnerParticipant(i18n.getLocale()))
    session.clearGiftOpened()
    router.replace(ROUTES.gift)
  }

  const form = el('form', { className: 'panel-form', noValidate: true }, [
    el('div', { className: 'field' }, [input, errorRegion]),
    submitButton,
  ])
  form.setAttribute('novalidate', '')
  form.addEventListener('submit', onSubmit)

  window.setTimeout(() => input.focus(), 40)

  return el('section', { className: 'screen screen--owner' }, [
    el('p', {
      id: 'owner-gate-lead',
      className: 'support gate-lead',
      textContent: i18n.t('gate.lead'),
    }),
    el('h1', {
      id: 'owner-gate-question',
      className: 'section-title',
      textContent: i18n.t('gate.question'),
    }),
    form,
    createButton({
      label: i18n.t('join.back'),
      variant: 'ghost',
      onClick: () => router.navigate(ROUTES.landing),
    }),
  ])
}
