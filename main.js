'use strict'

// includes
var async = require('async')
var mkdir = require('mkdirp')
var sharp = require('sharp')
var readFile = require('fs').readFile
console.time('runtime')
const { resize, extract, rotate, quality, format } = require('./strategies')

// thumb sizes
var thumbs = [
	{ dir: 'thumbs/300x100/', steps: [ resize.crop(300, 100) ] },
	{ dir: 'thumbs/100x300/', steps: [ resize.crop(100, 300) ] },
	{ dir: 'thumbs/200x200/', steps: [ resize.crop(200, 200) ] },
	{ dir: 'thumbs/hs/',      steps: [ resize.fit(625, 400, quality.best), format.jpeg(95) ], ext: 'jpg' },
]

// parameters
var fname = 'image.png'
var thumbCoords = {} //{ x1: 0, y1: 0, x2: 720, y2: 720 }
var rotation = 0

// util
var then = (next) => (buffer) => next(null, buffer)
var error = (next) => (err) => next(err)

// combine full path with extension replace
var path = (dir, fname, ext) =>
	dir + ( ext ? fname.replace(/([^\.]+)$/, ext) : fname )

// user transform: extract & rotate
var user_transform = (() => {
	var pre = []
	if (thumbCoords && Object.keys(thumbCoords).length !== 0) pre.push(extract(thumbCoords))
	if (rotation) pre.push(rotate(rotation))
	return ( pre.length ? (steps) => pre.concat(steps) : (steps) => steps )
})()

// resize
var thumb_transform = ({dir: dir, steps: steps, ext: ext}, buffer, next) => {
	var s = sharp(buffer)
	user_transform(steps).forEach(step => step(s))
	s
		.toFile(path(dir, fname, ext))
		.then(then(next))
		.catch(error(next))
}

async.waterfall(
	[
		// load file
		(next) => readFile(fname, next),
		// concurrent processing
		(buffer, next) => async.eachLimit(
			thumbs, // collection
			8, 		// maxThreads
			// for each element in the collection
			(thumb, next) => async.reflect(async.waterfall( // don'fail
				[
					// create directory
					(next) => mkdir(thumb.dir, error(next)),
					// generate thumbnauil
					(next) => thumb_transform(thumb, buffer, next),
					// upload thumbnail
					//(buffer, next) => upload(thumb, buffer, next),
				],
				(err) => {
					var p = path(thumb.dir, fname, thumb.ext)
					if (err) console.error('failed to generate /' + p)
					else console.log('generated /' + p)
					next(err)
				}
			)),
			next
		),
	],
	(err) => {
		if (err) console.error(err)
		else console.log('success')
		console.timeEnd('runtime')
	}
)