export default Object.freeze({
	APP_VERSION: process.env.npm_package_version,
	APP_NAME: 'dev-bot',
	DB_NAME: 'devops',
	
	MONGODB_URI_PARTIAL: `${process.env.MONGODB_PREFIX}://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASS}@${process.env.MONGODB_CLUSTER}/`,
	
	DB_COLLECTION_DISCORD_USERS: 'discordUsers',
	
	GITHUB_ORG: 'BanklessDAO',
});
