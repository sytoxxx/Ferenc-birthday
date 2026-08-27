import { el } from '../lib/dom.js'

export function createButton({
  label,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  ariaLabel,
  ariaExpanded,
  ariaCurrent,
  className = '',
  children,
} = {}) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')

  return el(
    'button',
    {
      type,
      className: classes,
      disabled,
      textContent: children ? undefined : label,
      onClick,
      'aria-label': ariaLabel || label,
      'aria-expanded': ariaExpanded,
      'aria-current': ariaCurrent,
    },
    children || [],
  )
}

export function createChoiceCard({ label, onClick }) {
  return el(
    'button',
    {
      type: 'button',
      className: 'choice-card',
      onClick,
    },
    [el('span', { className: 'choice-card__label', textContent: label })],
  )
}
