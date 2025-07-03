const { series, src, dest } = require('gulp');
const { rm } = require('fs/promises');

// Deletes the dist folder
function clean() {
	return rm('./dist', { recursive: true, force: true });
}

function copyAssets() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

exports.clean = clean;
exports.copyAssets = copyAssets;

exports.build = series(clean, copyAssets);
exports.dev = series(clean, copyAssets); 