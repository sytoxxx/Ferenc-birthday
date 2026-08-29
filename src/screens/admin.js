import { el } from '../lib/dom.js'
import { checkAdminGateAnswer, isAdminUnlocked, lockAdmin, unlockAdmin } from '../app/admin-auth.js'
import { loadMergedPhotos, PHOTO_TABLE, PHOTO_BUCKET } from '../app/photos.js'
import { loadMergedMessages, MESSAGE_TABLE } from '../app/messages.js'
import { loadMergedVoices, VOICE_TABLE, VOICE_BUCKET } from '../app/voices.js'
import { listRemoteVotes, tallyVotes } from '../app/votes.js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import { clearContributions, removeContribution } from '../app/contributions.js'
import { removeItem } from '../lib/storage.js'
import { announce, createLiveRegion } from '../lib/errors.js'
import { createButton } from '../ui/button.js'
import { openSheet } from '../ui/sheet.js'
import { bindPhotoOpen } from '../ui/photo-viewer.js'
import { createAudioCard, createMessageCard } from '../ui/memory.js'

function uniqueByKey(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = String(item.id || item.filePath || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function adminCard(emoji, label, value) {
  return el('article', { className: 'admin-card' }, [
    el('p', { className: 'admin-card__label', textContent: `${emoji} ${label}` }),
    el('p', { className: 'admin-card__value', textContent: String(value) }),
  ])
}

async function countRows(table) {
  const client = getSupabaseClient()
  if (!client) return 0
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true })
  if (error) return 0
  return count || 0
}

async function tryDeleteRow(table, id) {
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured() || !id) return { ok: false, code: 'notConfigured' }
  const { error, count } = await client.from(table).delete({ count: 'exact' }).eq('id', id)
  if (error) return { ok: false, code: 'rls', error }
  if (count === 0) return { ok: false, code: 'rls' }
  return { ok: true }
}

async function tryRemoveStorage(bucket, filePath) {
  const client = getSupabaseClient()
  if (!client || !filePath) return
  await client.storage.from(bucket).remove([filePath])
}

async function tryRemoteReset() {
  const client = getSupabaseClient()
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, code: 'notConfigured' }
  }

  const tables = ['photo_votes', 'reactions', 'voices', 'messages', 'photos']
  const failed = []
  for (const table of tables) {
    const { error } = await client.from(table).delete().gte('created_at', '1970-01-01T00:00:00Z')
    if (error) failed.push(table)
  }

  return failed.length ? { ok: false, code: 'rls', failed } : { ok: true }
}

function clearLocalTestData() {
  clearContributions()
  removeItem('votes')
  removeItem('votedPhotoIds')
}

function rankPhotos(photos) {
  const counts = new Map()
  for (const photo of photos.filter((item) => item.withFerenc)) {
    const name = photo.displayName || '—'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
}

export function renderAdmin({ i18n, router }) {
  if (!isAdminUnlocked()) {
    const errorRegion = createLiveRegion({ polite: false })
    errorRegion.classList.add('field-error')
    const input = el('input', {
      className: 'field__input',
      type: 'text',
      autocomplete: 'off',
      spellcheck: false,
    })
    const submit = createButton({
      label: i18n.t('admin.submit'),
      type: 'submit',
      variant: 'primary',
    })

    const onSubmit = (event) => {
      event.preventDefault()
      const result = checkAdminGateAnswer(input.value)
      if (!result.ok) {
        errorRegion.textContent = i18n.t(result.code === 'empty' ? 'admin.empty' : 'admin.wrong')
        announce(errorRegion, errorRegion.textContent)
        return
      }
      unlockAdmin()
      router.refresh()
    }

    const form = el('form', { className: 'panel-form', noValidate: true }, [
      el('div', { className: 'field' }, [input, errorRegion]),
      submit,
    ])
    form.addEventListener('submit', onSubmit)
    window.setTimeout(() => input.focus(), 40)

    return el('section', { className: 'screen screen--admin screen--join' }, [
      el('p', { className: 'eyebrow', textContent: i18n.t('admin.kicker') }),
      el('h1', { className: 'section-title', textContent: i18n.t('admin.gateTitle') }),
      el('p', { className: 'support', textContent: i18n.t('admin.gateLead') }),
      el('p', { className: 'support', textContent: i18n.t('admin.notice') }),
      form,
    ])
  }

  const overview = el('div', { className: 'admin-cards' }, [
    el('p', { className: 'empty', textContent: i18n.t('admin.loading') }),
  ])
  const challenge = el('div', { className: 'admin-cards' })
  const ranking = el('div', { className: 'admin-ranking' })
  const photoList = el('div', { className: 'admin-list' })
  const messageList = el('div', { className: 'admin-list' })
  const voiceList = el('div', { className: 'admin-list' })
  const status = el('p', { className: 'composer-status' })
  const locale = i18n.getLocale()

  const setStatus = (text) => {
    status.textContent = text
    announce(status, text)
  }

  const renderContent = (photos, messages, voices) => {
    photoList.replaceChildren(
      ...(photos.length
        ? photos.map((photo) => {
            const row = el('article', { className: 'admin-item' }, [
              photo.url
                ? bindPhotoOpen(
                    el('img', {
                      className: 'admin-item__thumb',
                      src: photo.url,
                      alt: photo.displayName || '',
                    }),
                    { src: photo.url, alt: photo.displayName || '', i18n },
                  )
                : el('div', { className: 'admin-item__thumb' }),
              el('div', { className: 'admin-item__body' }, [
                el('p', { className: 'admin-item__title', textContent: photo.displayName || '—' }),
                el('p', { className: 'admin-item__meta', textContent: photo.destination || 'today' }),
              ]),
              createButton({
                label: i18n.t('admin.delete'),
                variant: 'ghost',
                className: 'admin-item__delete',
                onClick: async () => {
                  removeContribution(photo.id)
                  const remote = await tryDeleteRow(PHOTO_TABLE, photo.id)
                  if (photo.filePath) await tryRemoveStorage(PHOTO_BUCKET, photo.filePath)
                  row.remove()
                  setStatus(remote.ok ? i18n.t('admin.deleted') : i18n.t('admin.deleteBlocked'))
                },
              }),
            ])
            return row
          })
        : [el('p', { className: 'empty', textContent: i18n.t('admin.none') })]),
    )

    messageList.replaceChildren(
      ...(messages.length
        ? messages.map((message) => {
            const card = createMessageCard({
              id: message.id,
              name: message.displayName,
              text: message.text,
              createdAt: message.createdAt,
              locale,
            })
            const row = el('article', { className: 'admin-item admin-item--stack' }, [
              card,
              createButton({
                label: i18n.t('admin.delete'),
                variant: 'ghost',
                className: 'admin-item__delete',
                onClick: async () => {
                  removeContribution(message.id)
                  const remote = await tryDeleteRow(MESSAGE_TABLE, message.id)
                  row.remove()
                  setStatus(remote.ok ? i18n.t('admin.deleted') : i18n.t('admin.deleteBlocked'))
                },
              }),
            ])
            return row
          })
        : [el('p', { className: 'empty', textContent: i18n.t('admin.none') })]),
    )

    voiceList.replaceChildren(
      ...(voices.length
        ? voices.map((voice) => {
            const card = createAudioCard({
              i18n,
              name: voice.displayName,
              createdAt: voice.createdAt,
              url: voice.url,
              duration: voice.duration,
              locale,
            })
            const row = el('article', { className: 'admin-item admin-item--stack' }, [
              card,
              createButton({
                label: i18n.t('admin.delete'),
                variant: 'ghost',
                className: 'admin-item__delete',
                onClick: async () => {
                  removeContribution(voice.id)
                  const remote = await tryDeleteRow(VOICE_TABLE, voice.id)
                  if (voice.filePath) await tryRemoveStorage(VOICE_BUCKET, voice.filePath)
                  row.remove()
                  setStatus(remote.ok ? i18n.t('admin.deleted') : i18n.t('admin.deleteBlocked'))
                },
              }),
            ])
            return row
          })
        : [el('p', { className: 'empty', textContent: i18n.t('admin.none') })]),
    )
  }

  const loadDashboard = () => {
    void Promise.all([
      loadMergedPhotos('today'),
      loadMergedPhotos('capsule'),
      loadMergedMessages('today'),
      loadMergedMessages('capsule'),
      loadMergedVoices('today'),
      loadMergedVoices('capsule'),
      listRemoteVotes(),
      countRows('participants'),
      countRows('reactions'),
    ]).then(
      ([
        todayPhotos,
        capsulePhotos,
        todayMessages,
        capsuleMessages,
        todayVoices,
        capsuleVoices,
        votes,
        participantCount,
        reactionCount,
      ]) => {
        if (!overview.isConnected) return
        const photos = uniqueByKey([...todayPhotos.photos, ...capsulePhotos.photos])
        const messages = uniqueByKey([...todayMessages.messages, ...capsuleMessages.messages])
        const voices = uniqueByKey([...todayVoices.voices, ...capsuleVoices.voices])
        const challengePhotos = photos.filter((item) => item.withFerenc)
        const ranks = rankPhotos(photos)
        const voteCounts = tallyVotes(votes.votes || [])
        const voteTotal = Object.values(voteCounts).reduce((sum, n) => sum + n, 0)
        const lead = ranks[0]

        overview.replaceChildren(
          adminCard('👥', i18n.t('admin.participants'), participantCount),
          adminCard('📸', i18n.t('admin.photos'), photos.length),
          adminCard('💬', i18n.t('admin.messages'), messages.length),
          adminCard('🎙️', i18n.t('admin.voices'), voices.length),
          adminCard('⚡', i18n.t('admin.reactions'), reactionCount),
        )

        challenge.replaceChildren(
          adminCard('📸', i18n.t('admin.challengePhotos'), challengePhotos.length),
          adminCard('🏆', i18n.t('admin.ranking'), lead ? `${lead.name} · ${lead.count}` : '—'),
          adminCard('🗳️', i18n.t('admin.votes'), voteTotal),
        )

        ranking.replaceChildren(
          ranks.length
            ? el(
                'ol',
                { className: 'leaderboard' },
                ranks.slice(0, 5).map((item, index) =>
                  el('li', { className: 'leaderboard__item' }, [
                    el('p', {
                      className: 'leaderboard__label',
                      textContent: `${index + 1}. ${item.name} — ${item.count}`,
                    }),
                  ]),
                ),
              )
            : el('p', { className: 'empty', textContent: i18n.t('admin.rankingEmpty') }),
        )

        renderContent(photos, messages, voices)
      },
    )
  }

  loadDashboard()

  const reset = createButton({
    label: i18n.t('admin.reset'),
    variant: 'choice',
    onClick: () => {
      let closeSheet = () => {}
      const sheet = openSheet({
        title: i18n.t('admin.resetConfirmTitle'),
        i18n,
        children: [
          el('p', { className: 'support', textContent: i18n.t('admin.resetConfirmBody') }),
          el('div', { className: 'sheet-actions' }, [
            createButton({
              label: i18n.t('contribute.cancel'),
              variant: 'ghost',
              onClick: () => closeSheet(),
            }),
            createButton({
              label: i18n.t('admin.resetForever'),
              variant: 'primary',
              onClick: async () => {
                closeSheet()
                clearLocalTestData()
                const remote = await tryRemoteReset()
                if (remote.ok) setStatus(i18n.t('admin.resetRemoteOk'))
                else if (remote.code === 'notConfigured') setStatus(i18n.t('admin.resetNotConfigured'))
                else setStatus(i18n.t('admin.resetRemoteBlocked'))
                loadDashboard()
              },
            }),
          ]),
        ],
      })
      closeSheet = sheet.close
    },
  })

  return el('section', { className: 'screen screen--admin' }, [
    el('p', { className: 'eyebrow', textContent: i18n.t('admin.kicker') }),
    el('h1', { className: 'section-title', textContent: i18n.t('admin.title') }),
    el('p', { className: 'support', textContent: i18n.t('admin.notice') }),
    el('h2', { className: 'block-title', textContent: i18n.t('admin.overview') }),
    overview,
    el('h2', { className: 'block-title', textContent: i18n.t('admin.challenge') }),
    challenge,
    ranking,
    el('h2', { className: 'block-title', textContent: i18n.t('admin.content') }),
    el('h3', { className: 'admin-subhead', textContent: `📸 ${i18n.t('admin.photos')}` }),
    photoList,
    el('h3', { className: 'admin-subhead', textContent: `💬 ${i18n.t('admin.messages')}` }),
    messageList,
    el('h3', { className: 'admin-subhead', textContent: `🎙️ ${i18n.t('admin.voices')}` }),
    voiceList,
    el('h2', { className: 'block-title', textContent: i18n.t('admin.resetTitle') }),
    el('p', { className: 'support', textContent: i18n.t('admin.resetBody') }),
    reset,
    status,
    createButton({
      label: i18n.t('admin.lock'),
      variant: 'ghost',
      onClick: () => {
        lockAdmin()
        router.refresh()
      },
    }),
  ])
}
