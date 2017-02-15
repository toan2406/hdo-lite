var express = require('express')
var router = express.Router()
const hdo = require('./hdo')

router.get('/', hdo.home)
router.get('/search', hdo.search)
router.get('/watch/:slug', hdo.watch)
router.get('/api/sub', hdo.sub)
router.get('/api/stream/*', hdo.stream)

module.exports = router
