module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint', 'n8n-nodes-base'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:n8n-nodes-base/community'],
	rules: {
		// Specific to the project
	},
}; 