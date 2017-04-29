'use strict'

var async = require('async')
var mkdir = require('mkdirp')
var sharp = require('sharp')

const { resize, extract } = require('./strategies')
const k = sharp.kernel;
const i = sharp.interpolator;

var q_default = { kernel: k.lanczos2, interpolator: i.bicubic }
var q_nearest = { kernel: k.nearest, interpolator: i.nearest }
var q_cubic = { kernel: k.cubic, interpolator: i.bicubic }
var q_best = { kernel: k.lanczos3, interpolator: i.nohalo }

var thumbs = [
	{ dir: 'thumbs/300x100/', w: 300, h: 100, f: resize.crop },
	{ dir: 'thumbs/100x300/', w: 100, h: 300, f: resize.crop },
	{ dir: 'thumbs/200x200/', w: 200, h: 200, f: resize.crop },
	{ dir: 'thumbs/hs/',      w: 625, h: 400, f: resize.fit,  q: q_best    },
]

var fname = 'image.png'
var thumbCoords = {} //{ x1: 0, y1: 0, x2: 720, y2: 720 }
var rotation = 0

var then = (next) => (buffer) => next(null, buffer)
var error = (next) => (err) => next(err)

var user_transform = (next) =>
	sharp(fname)
		.pipe(extract(thumbCoords))
		.rotate((rotation + 360) % 360)
		.toBuffer()
		.then(then(next))
		.catch(error(next))

var thumb_transform = ({dir: dir, w: w, h: h, f: f, q: q = q_default}, buffer, next) => 
	sharp(buffer)
		.pipe(f(w, h, q))
		.toBuffer()
		.then(then(next))
		.catch(error(next))

var upload = ({dir: dir}, buffer, next) =>
	sharp(buffer)
		.toFile(dir + fname)
		.then(then(next))
		.catch(error(next))

async.waterfall(
	[
		user_transform,
		(buffer, next) => async.eachLimit(
			thumbs, // collection
			8, 		// maxThreads
			(thumb, next) => async.reflect(async.waterfall(
				[
					(next) => mkdir(thumb.dir, error(next)),
					(next) => thumb_transform(thumb, buffer, next),
					(buffer, next) => upload(thumb, buffer, next),
				],
				(err) => {
					if (err) console.error('failed to generate /' + thumb.dir + fname)
					else console.log('generated /' + thumb.dir + fname)
					next(err)
				}
			)),
			(err) => {
				if (err) console.error(err)
				next(err)
			}
		),
	],
	(err) => {
		if (err) console.error(err)
		else console.log('success')
	}
)