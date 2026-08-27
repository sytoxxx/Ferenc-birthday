import { el, clear } from '../lib/dom.js'
import { createComposer } from '../ui/composer.js'
import { bindPhotoOpen } from '../ui/photo-viewer.js'
import { loadMergedPhotos, listLocalPhotos, subscribePhotoInserts } from '../app/photos.js'
import { listRemoteVotes, sendPhotoVote, tallyVotes, votedPhotoIdsFor } from '../app/votes.js'
import { createButton } from '../ui/button.js'

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

const MEDALS = ['🥇', '🥈', '🥉']

function renderLeaderboard(host, ranks, i18n) {
  clear(host)
  if (!ranks.length) {
    host.append(el('p', { className: 'empty', textContent: i18n.t('challenge.empty') }))
    return
  }
  const max = Math.max(...ranks.map((item) => item.count), 1)
  host.append(
    el(
      'ol',
      { className: 'leaderboard' },
      ranks.map((item, index) =>
        el('li', { className: 'leaderboard__item' }, [
          el('p', {
            className: 'leaderboard__label',
            textContent: `${MEDALS[index] || `${index + 1}.`} ${item.name} — ${item.count}`,
          }),
          el('div', { className: 'leaderboard__track' }, [
            el('span', {
              className: 'leaderboard__fill',
              style: { width: `${Math.round((item.count / max) * 100)}%` },
            }),
          ]),
        ]),
      ),
    ),
  )
}

function renderVoteList(host, photos, { i18n, session, votes, onVoted }) {
  clear(host)
  if (!photos.length) {
    host.append(el('p', { className: 'empty', textContent: i18n.t('photo.none') }))
    return
  }

  const counts = tallyVotes(votes)
  const voted = votedPhotoIdsFor(votes, session.getParticipant())
  const leaderId = photos.reduce((best, item) => {
    const score = counts[item.id] || 0
    if (!best || score > (counts[best] || 0)) return item.id
    return best
  }, null)

  host.append(
    el(
      'div',
      { className: 'vote-list' },
      photos.map((item) => {
        const score = counts[item.id] || 0
        const isLeader = item.id === leaderId && score > 0
        const hasVoted = voted.includes(String(item.id))
        return el('article', { className: `vote-card${isLeader ? ' is-leader' : ''}` }, [
          item.url
            ? bindPhotoOpen(el('img', { className: 'vote-card__image', src: item.url, alt: item.displayName }), {
                src: item.url,
                alt: item.displayName,
                i18n,
              })
            : null,
          el('p', { className: 'vote-card__by', textContent: i18n.t('photo.by', { name: item.displayName }) }),
          el('p', { className: 'vote-card__votes', textContent: i18n.t('photo.votes', { count: score }) }),
          isLeader ? el('p', { className: 'vote-card__lead', textContent: i18n.t('photo.leader') }) : null,
          createButton({
            label: hasVoted ? i18n.t('photo.alreadyVoted') : i18n.t('photo.vote'),
            disabled: hasVoted,
            onClick: async () => {
              const result = await sendPhotoVote({
                photoId: item.id,
                participant: session.getParticipant(),
              })
              if (result.ok || result.code === 'alreadyVoted') onVoted()
            },
          }),
        ])
      }),
    ),
  )
}

export function renderChallenge({ i18n, session }) {
  const board = el('div', { className: 'challenge-board' })
  const voteHost = el('div', { className: 'vote-host' })
  let photos = listLocalPhotos('today')
  let votes = []

  const refreshBoard = () => {
    renderLeaderboard(board, rankPhotos(photos), i18n)
  }

  const refreshVotes = () => {
    const challengePhotos = photos.filter((item) => item.withFerenc)
    renderVoteList(voteHost, challengePhotos.length ? challengePhotos : photos, {
      i18n,
      session,
      votes,
      onVoted: () => {
        void listRemoteVotes().then((result) => {
          votes = result.votes
          refreshVotes()
        })
      },
    })
  }

  const applyPhotos = (next) => {
    photos = next
    refreshBoard()
    refreshVotes()
  }

  refreshBoard()
  refreshVotes()

  void loadMergedPhotos('today').then(({ photos: remotePhotos }) => {
    if (!board.isConnected) return
    applyPhotos(remotePhotos)
  })

  void listRemoteVotes().then((result) => {
    if (!voteHost.isConnected) return
    votes = result.votes
    refreshVotes()
  })

  subscribePhotoInserts((photo) => {
    if (!board.isConnected) return
    if ((photo.destination || 'today') !== 'today') return
    if (photos.some((item) => item.id === photo.id || (photo.filePath && item.filePath === photo.filePath))) return
    applyPhotos([photo, ...photos])
  })

  return el('section', { className: 'screen screen--challenge' }, [
    el('h1', { className: 'section-title', textContent: i18n.t('challenge.title') }),
    el('p', { className: 'support', textContent: i18n.t('challenge.lead') }),
    createComposer({
      i18n,
      session,
      destination: 'today',
      showPrompt: false,
      withFerencDefault: true,
      onPhotoAdded: (photo) => applyPhotos([photo, ...photos]),
    }),
    el('h2', { className: 'block-title', textContent: i18n.t('challenge.ranking') }),
    board,
    el('h2', { className: 'block-title', textContent: i18n.t('photo.winner') }),
    el('p', { className: 'support', textContent: i18n.t('photo.body') }),
    voteHost,
  ])
}

export function renderPhotoOfTheDay(ctx) {
  return renderChallenge(ctx)
}
