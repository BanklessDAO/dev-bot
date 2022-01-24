import { CommandContext } from 'slash-create';
import { GuildMember } from 'discord.js';
import Log from '../../utils/Log';
import {
	createOAuthAppAuth,
} from '@octokit/auth-oauth-app';
import apiKeys from '../constants/apiKeys';
import {
	OAuthAppAuthInterface,
	OAuthAppDeviceFlowAuthOptions,
} from '@octokit/auth-oauth-app/dist-types/types';
import { Verification } from '@octokit/auth-oauth-device/dist-types/types';
import ServiceUtils from '../../utils/ServiceUtils';
import { OAuthAppAuthentication } from '@octokit/oauth-methods/dist-types/types';
import {
	Collection,
	Db,
	ModifyResult,
} from 'mongodb';
import MongoDbUtils from '../../utils/MongoDbUtils';
import constants from '../constants/constants';
import { DiscordUserCollection } from '../../types/mongodb/DiscordUserCollection';
import { Octokit } from '@octokit/rest';

export type VerifiedGithub = {
	accessToken: string,
	id: number,
	email: string,
	username: string,
	profileUrl: string,
	avatarUrl: string,
};

const VerifyGithub = async (ctx: CommandContext, guildMember: GuildMember): Promise<void> => {
	Log.debug('starting to verify github account link');
	
	const isDmOn: boolean = await ServiceUtils.tryDMUser(guildMember, 'Attempting to verify account!');
	
	await ctx.defer(true);
	
	if (!isDmOn) {
		await ctx.send({ content: 'Please turn on DMs and try again!', ephemeral: true });
		return;
	} else {
		await ctx.send({ content: 'DM sent!', ephemeral: true });
	}
	try {
		let verifiedGithub: VerifiedGithub | null = await retrieveVerifiedGithub(guildMember);
		
		if (verifiedGithub) {
			Log.info('found existing verified github account');
			await displayGithubAccount(guildMember, verifiedGithub);
			return;
		}
		
		const auth: OAuthAppAuthInterface = createOAuthAppAuth({
			clientType: 'oauth-app',
			clientId: apiKeys.GITHUB_CLIENT_ID,
			clientSecret: apiKeys.GITHUB_CLIENT_SECRET,
		});
		const options: OAuthAppDeviceFlowAuthOptions = {
			type: 'oauth-user',
			scopes: ['write:org'],
			async onVerification(verification: Verification): Promise<void> {
				await guildMember.send({ content: `Please enter code \`${verification.user_code}\` on page ${verification.verification_uri}` });
				Log.debug(verification);
			},
		};
	
		const userAuthenticationFromDeviceFlow: OAuthAppAuthentication = await auth(options);
		verifiedGithub = await retrieveVerifiedGithub(guildMember, userAuthenticationFromDeviceFlow.token);
		await linkGithubAccount(guildMember, verifiedGithub);
		
		Log.debug('finished verifying github slash command');
		await displayGithubAccount(guildMember, verifiedGithub);
	} catch (e) {
		Log.error('failed to authenticate user', e);
		await ctx.send({ content: 'Please try authentication again.', ephemeral: true });
	}
};

const linkGithubAccount = async (guildMember: GuildMember, verifiedGithub: VerifiedGithub): Promise<void> => {
	Log.debug('attempting to link github account');
	const db: Db = await MongoDbUtils.connect(constants.DB_NAME);
	const discordUsersCollection: Collection<DiscordUserCollection> = db.collection(constants.DB_COLLECTION_DISCORD_USERS);
	
	const result: ModifyResult<DiscordUserCollection> = await discordUsersCollection.findOneAndUpdate({
		userId: guildMember.id.toString(),
	}, {
		$set: {
			userId: guildMember.id.toString(),
			tag: guildMember.user.tag,
			github: {
				id: verifiedGithub.id,
				accessToken: verifiedGithub.accessToken,
			},
		},
	}, {
		upsert: true,
	});
	
	if (result.ok != 1) {
		throw new Error('failed to link github account');
	}
	Log.debug('successfully linked github account');
};

export const retrieveVerifiedGithub = async (guildMember: GuildMember, accessToken?: string): Promise<VerifiedGithub | null> => {
	Log.debug('starting to retrieve github account');
	
	if (accessToken == null) {
		const db: Db = await MongoDbUtils.connect(constants.DB_NAME);
		const accountsCollection: Collection<DiscordUserCollection> = db.collection(constants.DB_COLLECTION_DISCORD_USERS);
		
		Log.debug('looking for discord auth account');
		const discordAccount: DiscordUserCollection | null = await accountsCollection.findOne({
			userId: guildMember.id.toString(),
		});
		
		if (discordAccount == null || discordAccount.userId == null || discordAccount.github == null || discordAccount.github.accessToken == null) {
			Log.debug('discord github account not found');
			return null;
		}
		accessToken = discordAccount.github.accessToken;
	}

	Log.debug('found discord account db, now verifying tokens');
	try {
		const appOctokit: Octokit = new Octokit({
			auth: accessToken,
		});
		
		const userResult = await appOctokit.users.getAuthenticated();
		
		Log.debug('called authenticated user from API');
		Log.debug(userResult);
		
		return {
			accessToken: accessToken,
			id: userResult.data.id,
			email: userResult.data.email,
			username: userResult.data.login,
			profileUrl: userResult.data.html_url,
			avatarUrl: userResult.data.avatar_url,
		};
	} catch (e) {
		Log.error('failed to authenticate github user', e);
	}
	return null;
};

const displayGithubAccount = async (guildMember: GuildMember, githubAccount: VerifiedGithub) => {
	await guildMember.send({
		embeds: [{
			title: 'Github Account Verification',
			description: 'Details regarding your account.',
			fields: [
				{ name: 'ID', value: `${githubAccount.id}` },
				{ name: 'Username', value: `${githubAccount.username}` },
				{ name: 'Email', value: `${githubAccount.email}` },
				{ name: 'Profile', value: `${githubAccount.profileUrl}` },
			],
			url: `${githubAccount.profileUrl}`,
			author: {
				name: `${githubAccount.username}`,
				iconURL: `${githubAccount.avatarUrl}`,
			},
		}],
	});
};

export default VerifyGithub;