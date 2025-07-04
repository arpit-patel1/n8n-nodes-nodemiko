const { series, src, dest } = require('gulp');
const { rm } = require('fs/promises');

// Deletes the dist folder
function clean() {
	return rm('./dist', { recursive: true, force: true });
}

function copyAssets() {
	// Copy nodes assets
	src(['nodes/**/*.svg', 'nodes/**/lib/**/*.js']).pipe(dest('dist/nodes'));
	// Copy credentials assets
	return src(['credentials/**/*.svg']).pipe(dest('dist/credentials'));
}

exports.clean = clean;
exports.copyAssets = copyAssets;

exports.build = series(clean, copyAssets);
exports.dev = series(clean, copyAssets); 