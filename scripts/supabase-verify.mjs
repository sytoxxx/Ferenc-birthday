import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.FLOW_BASE || 'http://127.0.0.1:5174'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PHOTO = path.join(os.tmpdir(), 'ferenc-test-photo.png')
const MESSAGE = `Live check ${Date.now()}`

fs.writeFileSync(
  PHOTO,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

function summarize(url) {
  try {
    const parsed = new URL(url)
    return parsed.pathname + parsed.search
  } catch {
    return 'invalid-url'
  }
}

function clickText(page, selector, text) {
  return page.evaluate(
    (sel, expected) => {
      const node = [...document.querySelectorAll(sel)].find(
        (item) => item.textContent.replace(/\s+/g, ' ').trim() === expected,
      )
      if (!node) throw new Error(`Missing ${sel} with text ${expected}`)
      node.click()
    },
    selector,
    text,
  )
}

const net = []
const results = []
function pass(name, extra = '') {
  results.push({ name, ok: true, extra })
  console.log(`PASS  ${name}${extra ? ` — ${extra}` : ''}`)
}
function fail(name, extra) {
  results.push({ name, ok: false, extra })
  console.log(`FAIL  ${name} — ${extra}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  page.on('response', async (response) => {
    const url = response.url()
    const method = response.request().method()
    if (!url.includes('supabase.co')) return
    const pathName = summarize(url)
    const status = response.status()
    let hasId = false
    let errorCode = ''
    try {
      if (method !== 'GET' && response.headers()['content-type']?.includes('json')) {
        const body = await response.json()
        if (Array.isArray(body) && body[0]?.id) hasId = true
        else if (body?.id) hasId = true
        else if (body?.code) errorCode = String(body.code)
        else if (body?.error) errorCode = String(body.error)
        else if (body?.message) errorCode = String(body.message).slice(0, 80)
      }
    } catch {
      // ignore body parse
    }
    net.push({ method, status, pathName, hasId, errorCode })
  })

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ferenc.locale', 'de')
    sessionStorage.setItem('ferenc.introDone', '1')
  })
  page.setDefaultTimeout(20000)

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.choice-card')
  await clickText(page, '.choice-card', 'Ich bin jemand anderes')
  await page.waitForSelector('#participant-name')
  await page.type('#participant-name', 'Levente')
  await clickText(page, 'button[type="submit"]', 'Weiter')
  await page.waitForSelector('.contribute-hello')

  await clickText(page, '.composer__action', 'Nachricht')
  await page.waitForSelector('textarea.field__input--area')
  await page.type('textarea.field__input--area', MESSAGE)
  await clickText(page, 'button', 'Senden')
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Nachricht hinzugefügt.') ||
      document.body.innerText.includes('Die Nachricht konnte nicht gesendet werden.') ||
      document.body.innerText.includes('Die Online-Speicherung ist noch nicht eingerichtet.'),
  )
  const msgBody = await page.evaluate(() => document.body.innerText)
  const msgRemote = msgBody.includes('Ferenc kann sie jetzt lesen.')
  const msgLocal = msgBody.includes('auf diesem Gerät')
  const msgFail = msgBody.includes('konnte nicht gesendet werden') || msgBody.includes('noch nicht eingerichtet')
  if (msgRemote) pass('message UI remote success')
  else if (msgLocal) fail('message UI remote success', 'saved locally only')
  else fail('message UI remote success', msgFail ? 'error shown' : 'unknown')

  if (msgRemote || msgLocal) {
    const closeLabel = msgRemote ? 'Fertig' : 'Schließen'
    await clickText(page, 'button', closeLabel)
  } else {
    await clickText(page, 'button', 'Schließen')
  }

  const msgPost = net.filter((item) => item.method === 'POST' && item.pathName.startsWith('/rest/v1/messages'))
  const msgGet = net.filter((item) => item.method === 'GET' && item.pathName.startsWith('/rest/v1/messages'))
  if (msgPost.some((item) => item.status >= 200 && item.status < 300 && item.hasId)) {
    pass('messages POST inserted row', msgPost.map((item) => item.status).join(','))
  } else {
    fail(
      'messages POST inserted row',
      msgPost.map((item) => `${item.status}:${item.errorCode || 'no-id'}`).join('; ') || 'no POST',
    )
  }
  if (msgGet.some((item) => item.status === 200)) pass('messages GET 200')
  else fail('messages GET 200', msgGet.map((item) => item.status).join(',') || 'no GET')

  await page.waitForSelector('.composer__action')
  await clickText(page, '.composer__action', 'Foto')
  await page.waitForSelector('.sheet')
  const gallery = await page.$('input[type="file"]:not([capture])')
  await gallery.uploadFile(PHOTO)
  await page.waitForSelector('.media-preview-frame:not([hidden])')
  await clickText(page, 'button', 'Foto senden')
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Foto hinzugefügt.') ||
      document.body.innerText.includes('Das Foto konnte nicht gesendet werden.'),
  )
  const photoBody = await page.evaluate(() => document.body.innerText)
  const photoRemote = photoBody.includes('Ferenc kann es jetzt sehen.')
  if (photoRemote) pass('photo UI remote success')
  else if (photoBody.includes('Foto hinzugefügt.')) fail('photo UI remote success', 'UI success but local hint')
  else fail('photo UI remote success', 'no success')

  const storagePost = net.filter(
    (item) => item.method === 'POST' && item.pathName.includes('/storage/v1/object/photos'),
  )
  const photosPost = net.filter((item) => item.method === 'POST' && item.pathName.startsWith('/rest/v1/photos'))
  if (storagePost.some((item) => item.status >= 200 && item.status < 300)) {
    pass('storage photos upload', storagePost.map((item) => item.status).join(','))
  } else {
    fail(
      'storage photos upload',
      storagePost.map((item) => `${item.status}:${item.errorCode || 'no-body'}`).join('; ') || 'no POST',
    )
  }
  if (photosPost.some((item) => item.status >= 200 && item.status < 300)) {
    pass('photos table insert', photosPost.map((item) => `${item.status}:id=${item.hasId}`).join(','))
  } else {
    fail(
      'photos table insert',
      photosPost.map((item) => `${item.status}:${item.errorCode || 'no-id'}`).join('; ') || 'no POST',
    )
  }

  console.log('network:')
  for (const item of net) {
    console.log(`  ${item.method} ${item.status} ${item.pathName} hasId=${item.hasId}${item.errorCode ? ` err=${item.errorCode}` : ''}`)
  }
} catch (error) {
  fail('runner', error.stack || error.message)
} finally {
  await browser.close()
}

const failed = results.filter((item) => !item.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exit(1)
