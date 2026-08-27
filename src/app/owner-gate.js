/**
 * Lightweight personal check for Ferenc's gift.
 * Accepted answers are never rendered in the UI.
 */

const CONNECTORS = new Set(['and', 'und', 'es', 'with', 'mit', 'plus', 'n'])

const EGG_TOKENS = new Set([
  'egg',
  'eggs',
  'ei',
  'eier',
  'eiern',
  'tojas',
  'tojast',
  'tojassal',
  'rantotta',
  'rantottat',
  'rantottaval',
  'ruehrei',
  'ruhrei',
  'spiegelei',
  'omelett',
  'omelette',
  'omlett',
  'omelet',
])

const HAM_TOKENS = new Set(['ham', 'hams', 'schinken', 'schinke', 'sonka', 'sonkas', 'sonkaval'])

const EGG_STEMS = ['egg', 'eier', 'tojas', 'rantotta', 'ruehrei', 'ruhrei', 'spiegelei', 'omelett', 'omelette']
const HAM_STEMS = ['schinken', 'sonka']

const REJECT_TOKENS = new Set([
  'pizza',
  'pizzas',
  'burger',
  'burgers',
  'hamburger',
  'hamburgers',
  'pasta',
  'spaghetti',
  'spagetti',
  'palatschinken',
  'palatschinke',
  'palacsinta',
  'palacsintak',
  'palacsintat',
  'pancake',
  'pancakes',
  'pfannkuchen',
  'crepe',
  'crepes',
  'salat',
  'salate',
  'salad',
  'salads',
  'schnitzel',
  'schnitzels',
])

function foldText(rawValue) {
  return String(rawValue ?? '')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function tokenize(rawValue) {
  const folded = foldText(rawValue)
    .replace(/[&+/\\|]/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!folded) return []

  return folded.split(' ').filter((token) => token && !CONNECTORS.has(token))
}

function levenshtein(left, right) {
  if (left === right) return 0

  const rows = left.length
  const cols = right.length
  const grid = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0))

  for (let row = 0; row <= rows; row += 1) grid[row][0] = row
  for (let col = 0; col <= cols; col += 1) grid[0][col] = col

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      grid[row][col] = Math.min(
        grid[row - 1][col] + 1,
        grid[row][col - 1] + 1,
        grid[row - 1][col - 1] + cost,
      )
    }
  }

  return grid[rows][cols]
}

function closeTo(token, keyword) {
  if (token === keyword) return true
  if (token.length < 3 || keyword.length < 3) return false
  const maxDistance = keyword.length <= 4 ? 1 : token.length <= 8 ? 1 : 2
  return levenshtein(token, keyword) <= maxDistance
}

function matchesKeyword(token, keywords, stems = []) {
  if (keywords.has(token)) return true
  if (stems.some((stem) => stem.length >= 4 && token.startsWith(stem))) return true
  for (const keyword of keywords) {
    if (closeTo(token, keyword)) return true
  }
  return false
}

function hasRejectedFood(tokens, compact) {
  if (tokens.some((token) => REJECT_TOKENS.has(token))) return true
  return [...REJECT_TOKENS].some((item) => item.length >= 5 && compact.includes(item))
}

export function checkOwnerGateAnswer(rawValue) {
  const tokens = tokenize(rawValue)
  if (!tokens.length) {
    return { ok: false, code: 'empty' }
  }

  const compact = tokens.join('')
  if (hasRejectedFood(tokens, compact)) {
    return { ok: false, code: 'wrong' }
  }

  const hasEgg = tokens.some((token) => matchesKeyword(token, EGG_TOKENS, EGG_STEMS))
  const hasHam = tokens.some((token) => {
    if (token === 'hamburger' || token.startsWith('hamburg')) return false
    return matchesKeyword(token, HAM_TOKENS, HAM_STEMS)
  })

  if (hasEgg || hasHam) {
    return { ok: true }
  }

  if (/(ham)?eggs|eggsham|schinkenei|eischinken|sonkatojas|tojasonka|rantotta/.test(compact)) {
    return { ok: true }
  }

  return { ok: false, code: 'wrong' }
}
