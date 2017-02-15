/* eslint-disable no-eval, no-unused-vars */
const request = require('superagent')
const cheerio = require('cheerio')
const kebabCase = require('lodash/kebabCase')

const DOMAIN = 'http://hdonline.vn'
const REQ_HEADERS = {
  Cookie: 'PHPSESSID=6h6mqff3b8h3ugathktkjcn206;',
  Referer: 'http://hdonline.vn/',
  Accept: '*/*'
}

exports.home = function (req, res, next) {
  res.render('index')
}

exports.search = function (req, res, next) {
  _search(req.query.key)
    .then((videos) => {
      res.render('search', {
        videos: videos
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.watch = function (req, res, next) {
  _findMedia(req.params.slug)
    .then((media) => {
      res.render('watch', {
        source: media['720']
      })
    })
    .catch((err) => {
      next(err)
    })
}

function _search (key) {
  const hdoSearchUrl = `${DOMAIN}/tim-kiem/${kebabCase(key)}.html`

  return request
    .get(hdoSearchUrl)
    .then((res) => _parseVideos(res.text))
}

function _findMedia (slug) {
  const hdoWatchUrl = `${DOMAIN}/${slug}.html`

  return request
    .get(hdoWatchUrl)
    .then((res) => {
      const sourceFile = _parseSourceFile(res.text)
      const sourceFileUrl = `${DOMAIN}${sourceFile}`
      return request
        .get(sourceFileUrl)
        .set(REQ_HEADERS)
    })
    .then((res) => _parseMedia(res.text))
}

function _parseVideos (html) {
  const $ = cheerio.load(html)
  const videos = $('.tn-bxitem').map((i, elem) => {
    const $elem = $(elem)
    const slug = $elem.find('.bxitem-link').attr('href').replace(/(^\/|\.html$)/g, '')
    const titleVi = $elem.find('.name-vi').text()
    const titleEn = $elem.find('.name-en').text()

    return {
      link: `/watch/${slug}`,
      title: {
        vi: titleVi,
        en: titleEn
      }
    }
  }).get()

  return videos
}

function _parseSourceFile (html) {
  const includesEval = (line) => line.includes('eval')
  const jwplayer = (element) => ({ setup: (config) => config })
  const evalLine = html.split('\n').find(includesEval)
  const jwplayerConfig = eval(evalLine)
  const sourceFile = jwplayerConfig.playlist[0].file

  return sourceFile
}

function _parseMedia (xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  let media = {}

  $('item').find('*').each((i, elem) => {
    if (elem.name.includes('jwplayer:vplugin.level')) {
      media[elem.name.match(/\d+/g)] = $(elem).text()
    }
  })

  return media
}
