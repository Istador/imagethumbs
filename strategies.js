'use strict'

var sharp = require('sharp')

const k = sharp.kernel;
const i = sharp.interpolator;
const q_def = {
	kernel: k.lanczos2,
	interpolator: i.bicubic,
}

var black 		= { r: 0,   g: 0,   b: 0,   alpha: 1 }
var white 		= { r: 255, g: 255, b: 255, alpha: 1 }
var transparent = { r: 255, g: 255, b: 255, alpha: 0 }

//crop(width, height, quality): scales the image to an appropriate size and crops it to the wanted aspect ratio
var crop = (gravity) => (w, h, q = q_def) => (s) => s.resize(w, h, q).crop(gravity)

// embed(width, height, quality): scales the image fitting inside the dimensions. a background color is used, if the aspect ratios doesn't match.
var embed = (color) => (w, h, q = q_def) => (s) => s.resize(w, h, q).background(color).embed()

// rotate(degrees): rotates the image in 90° steps
var rotate = (degrees) => {
	var deg = Math.round(((degrees + 360) % 360) / 90) * 90;
	return ( deg != 0 ? (s) => s.rotate(deg) : () => {} )
}

/**
 * all possible parameters:
 *   left, top, right, bottom, width, height, l, t, r, b, w, h, x1, y1, x2, y2, x, y
 *
 * equivalent parameters (interchangeable):
 *   left   = l = x1 = x
 *   top    = t = y1 = y
 *   right  = r = x2
 *   bottom = b = y2
 *   width  = w
 *   height = h
 * 
 * The parameters have to define two points or one point with width and height
 */
var extract = ({
	x: x, y: y,
	x1: x1 = x, y1: y1 = y,
	x2: x2, y2: y2,
	left: left = x1, top: top = y1,
	right: right = x2, bottom: bottom = y2,
	l: l = left, t: t = top,
	r: r = right, b: b = bottom,
	width: width, height: height,
	w: w = width, h: h = height,
}) => (s) => {
	if (l !== undefined && r !== undefined) { 
		if (l > r) { [l, r] = [r, l] }
		if (! w) { w = r - l }
	}
	else if (r !== undefined && w !== undefined) { l = r - w }
	else if (l === undefined  || w === undefined) { return sharp() }
	
	if (t !== undefined && b !== undefined) {
		if (t > b) { [t, b] = [b, t] }
		if (! h) { h = b - t }
	}
	else if (b !== undefined && h !== undefined) { t = b - h }
	else if (t === undefined  || h === undefined) { return sharp() }
	
	return s.extract({ left: l, top: t, width: w, height: h })
}

// makes an function out of an object, so that it can be used as both
var fx = (def) => (obj) => {
	var f = (...args) => obj[def](...args)
	for (var k in obj) { f[k] = obj[k] }
	return f
};
var c = fx('center')
var m = fx('middle')
var e = fx('custom')

module.exports = {
	resize: {
		// the resulting image might not display everything
		crop: c({
			top: c({
				left:   crop(sharp.gravity.northwest),
				center: crop(sharp.gravity.north),
				right:  crop(sharp.gravity.northeast),
			}),
			middle: c({
				left:   crop(sharp.gravity.west),
				center: crop(sharp.gravity.center),
				right:  crop(sharp.gravity.east),
			}),
			bottom: c({
				left:   crop(sharp.gravity.southwest),
				center: crop(sharp.gravity.south),
				right:  crop(sharp.gravity.southeast),
			}),
			left: m({
				top:    crop(sharp.gravity.northwest),
				middle: crop(sharp.gravity.west),
				bottom: crop(sharp.gravity.southwest),
			}),
			center: m({
				top:    crop(sharp.gravity.north),
				middle: crop(sharp.gravity.center),
				bottom: crop(sharp.gravity.south),
			}),
			right: m({
				top:    crop(sharp.gravity.northeast),
				middle: crop(sharp.gravity.east),
				bottom: crop(sharp.gravity.southeast),
			}),
		}),
		// the resulting image's dimensions might be smaller
		fit: (w, h, q = q_def) => (s) => s.resize(w, h, q).max(),
		// the resulting image might be stretched
		stretch: (w, h, q = q_def) => (s) => s.resize(w, h, q).ignoreAspectRatio(),
		// the resulting image might have a background color
		embed: e({
			custom: embed,
			black: embed(black),
			white: embed(white),
			transparent: embed(transparent),
		}),
	},
	extract: extract,
	rotate: rotate,
	quality: {
		nearest: { kernel: k.nearest, interpolator: i.nearest },
		cubic: { kernel: k.cubic, interpolator: i.bicubic },
		best: { kernel: k.lanczos3, interpolator: i.nohalo },
		default: q_def,
	},
	format: {
		jpeg: (q = 95) => (s) => s.jpeg({
			quality: Math.max(1, Math.min(100, q)),
			progressive: true,
			force: true,
		}),
		png: (q = 8) => (s) => s.png({
			compressionLevel: Math.max(1, Math.min(9, q)),
			progressive: true,
			force: true,
		}),
	}
}