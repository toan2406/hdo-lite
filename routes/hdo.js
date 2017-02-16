/* eslint-disable no-eval, no-unused-vars */
const request = require('superagent')
const cheerio = require('cheerio')
const srt2vtt = require('srt2vtt')
const url = require('url')
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
      console.log('==========')
      console.log(videos)
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
        media: JSON.stringify(media)
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.sub = function (req, res, next) {
  if (!req.query.url) {
    return res.sendStatus(200)
  }

  request
    .get(req.query.url)
    .buffer(true)
    .then((res) => {
      return res.body
    })
    .then((buffer) => {
      srt2vtt(buffer, 'utf16le', function (err, data) {
        if (err) throw new Error(err)
        res.send(data.toString())
      })
    })
    .catch(() => {
      res.sendStatus(200)
    })
}

exports.stream = function (req, res, next) {
  const hlsStreamUrl = req.originalUrl.replace('/api/stream/', 'http://')
  req.pipe(request.get(hlsStreamUrl)).pipe(res)
}

function _search (key) {
  const hdoSearchUrl = `${DOMAIN}/tim-kiem/${kebabCase(key)}.html`
  console.log('==========')
  console.log(hdoSearchUrl)

  return request
    .get(hdoSearchUrl)
    .then((res) => {
      console.log('==========')
      console.log(res.text)
      return _parseVideos(res.text)
    })
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
  const hasEval = (line) => line.includes('eval')
  const jwplayer = (element) => ({ setup: (config) => config })
  const evalLine = html.split('\n').find(hasEval)
  const jwplayerConfig = eval(evalLine)
  const sourceFile = jwplayerConfig.playlist[0].file

  return sourceFile
}

function _parseMedia (xml) {
  const isVsub = (file) => file.includes('VIE')
  const isEsub = (file) => file.includes('ENG')
  const $ = cheerio.load(xml, { xmlMode: true })

  let media = {
    source: {},
    subtitle: {}
  }

  $('item').find('*').each((i, elem) => {
    if (elem.name.includes('jwplayer:file')) {
      const streamUrl = $(elem).text()
      const urlObj = url.parse(streamUrl)

      if (streamUrl.includes('m3u8')) {
        media.source.hls = `/api/stream/${urlObj.host + urlObj.path}`
      }

      if (streamUrl.includes('mp4')) {
        media.source.mp4 = streamUrl
      }
    }

    if (elem.name.includes('jwplayer:vplugin.level')) {
      const streamUrl = $(elem).text()
      const resolution = elem.name.match(/\d+/g)
      media.source['r' + resolution] = streamUrl
    }

    if (elem.name.includes('jwplayer:vplugin.subfile')) {
      const subFiles = $(elem).text().split(',')
      const vsub = subFiles.find(isVsub)
      const esub = subFiles.find(isEsub)
      media.subtitle.vi = `/api/sub?url=${encodeURIComponent(vsub)}`
      media.subtitle.en = `/api/sub?url=${encodeURIComponent(esub)}`
    }
  })

  return media
}
