var express = require('express')
var router = express.Router()
const hdo = require('./hdo')

router.get('/', hdo.home)
router.get('/search', hdo.search)
router.get('/watch/:slug', hdo.watch)

module.exports = router
