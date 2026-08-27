import { el } from '../lib/dom.js'
import { ROUTES } from '../app/router.js'
import { createButton } from '../ui/button.js'
import { announce, createLiveRegion } from '../lib/errors.js'
import {
  buildLocalParticipant,
  NAME_MAX_LENGTH,
  syncParticipantToSupabase,
  validateDisplayName,
} from '../app/participant.js'

function errorMessage(i18n, code) {
  return i18n.t(`join.${code === 'name_too_long' ? 'errorTooLong' : 'errorEmpty'}`)
}

export function renderJoin({ i18n, session, router }) {
  const errorRegion = createLiveRegion({ polite: false })
  errorRegion.classList.add('field-error')
  errorRegion.id = 'join-name-error'

  const input = el('input', {
    id: 'participant-name',
    className: 'field__input',
    type: 'text',
    name: 'displayName',
    autocomplete: 'given-name',
    enterKeyHint: 'done',
    maxLength: NAME_MAX_LENGTH,
    spellcheck: false,
    'aria-describedby': 'join-name-help join-name-error',
  })
  input.placeholder = i18n.t('join.namePlaceholder')

  const help = el('p', {
    id: 'join-name-help',
    className: 'field__help',
    textContent: i18n.t('join.lead'),
  })

  const submitButton = createButton({
    label: i18n.t('join.submit'),
    type: 'submit',
    variant: 'primary',
    disabled: true,
  })

  const setError = (message) => {
    errorRegion.textContent = message
    input.setAttribute('aria-invalid', message ? 'true' : 'false')
    announce(errorRegion, message)
  }

  const syncSubmitState = () => {
    const result = validateDisplayName(input.value)
    submitButton.disabled = !result.ok
    if (result.ok) {
      setError('')
    }
  }

  const completeJoin = (displayName) => {
    const participant = buildLocalParticipant(displayName, i18n.getLocale())
    session.becomeParticipant(participant)
    router.navigate(ROUTES.today)
    void syncParticipantToSupabase(participant).catch(() => {})
  }

  const onSubmit = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const result = validateDisplayName(input.value)
    if (!result.ok) {
      const message = errorMessage(i18n, result.code)
      setError(message)
      submitButton.disabled = true
      input.focus()
      return
    }

    setError('')
    completeJoin(result.displayName)
  }

  input.addEventListener('input', syncSubmitState)
  input.addEventListener('change', syncSubmitState)
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onSubmit(event)
  })

  const form = el('form', { className: 'panel-form', noValidate: true }, [
    el('div', { className: 'field' }, [
      el('label', {
        className: 'field__label',
        htmlFor: 'participant-name',
        textContent: i18n.t('join.nameLabel'),
      }),
      input,
      help,
      errorRegion,
    ]),
    submitButton,
  ])
  form.setAttribute('novalidate', '')
  form.addEventListener('submit', onSubmit)

  syncSubmitState()
  window.setTimeout(() => input.focus(), 40)

  return el('section', { className: 'screen screen--join' }, [
    el('h1', { className: 'section-title', textContent: i18n.t('join.title') }),
    form,
    createButton({
      label: i18n.t('join.back'),
      variant: 'ghost',
      onClick: () => router.navigate(ROUTES.landing),
    }),
  ])
}
