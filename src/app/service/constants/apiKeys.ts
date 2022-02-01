const apiKeys = Object.freeze({
	DISCORD_BOT_ID: process.env.DISCORD_BOT_APPLICATION_ID,
	
	logDNAToken: process.env.LOGDNA_TOKEN as string,
	logDNAAppName: process.env.LOGDNA_APP_NAME,
	logDNADefault: process.env.LOGDNA_DEFAULT_LEVEL,
	
	sentryDSN: process.env.SENTRY_IO_DSN,
	
	GITHUB_APP_ID: process.env.GITHUB_APP_ID,
	GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
	GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
});

export default apiKeys;