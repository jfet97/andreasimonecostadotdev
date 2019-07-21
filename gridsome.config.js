const tailwindcss = require("tailwindcss");
const purgecss = require("@fullhuman/postcss-purgecss");

module.exports = {
	siteName: 'andreasimonecostadotdev',
	transformers: {
		remark: {
			externalLinksTarget: '_blank',
			externalLinksRel: ['nofollow', 'noopener', 'noreferrer'],
			anchorClassName: 'icon icon-link',
			plugins: [
				// ...global plugins
			]
		}
	},
	plugins: [
		{
			use: '@gridsome/source-filesystem',
			options: {
				path: 'content/tags/**/*.md',
				typeName: 'Tag',
				route: '/tag/:slug'
			}
		},
		{
			use: '@gridsome/source-filesystem',
			options: {
				path: 'content/posts/**/*.md',
				typeName: 'Post',
				route: '/blog/:slug',
				refs: {
					tags: "Tag"
				}
			}
		},
		{
			use: `gridsome-plugin-netlify-cms`,
			options: {
				publicPath: `/admin`
			}
		},
	],
	css: {
		loaderOptions: {
			postcss: {
				plugins: [
					tailwindcss,
					...process.env.NODE_ENV === "production" ? [purgecss] : []
				],
			},
		},
	}
}
