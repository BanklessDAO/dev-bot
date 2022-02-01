import { CommandContext } from 'slash-create';
import {
	GuildMember,
	Message,
	MessageActionRow,
	MessageButton,
} from 'discord.js';
import Log from '../../utils/Log';
import {
	createAppAuth,
} from '@octokit/auth-app';
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
	DeleteResult,
	ModifyResult,
} from 'mongodb';
import MongoDbUtils from '../../utils/MongoDbUtils';
import constants from '../constants/constants';
import { DiscordUserCollection } from '../../types/mongodb/DiscordUserCollection';
import { Octokit } from '@octokit/rest';
import buttonIds from '../constants/buttonIds';

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
			await askUnlinkGithubAccount(guildMember);
			return;
		}
		
		const auth: OAuthAppAuthInterface = createAppAuth({
			appId: apiKeys.GITHUB_APP_ID,
			clientId: apiKeys.GITHUB_CLIENT_ID,
			clientSecret: apiKeys.GITHUB_CLIENT_SECRET,
			privateKey: apiKeys.GITHUB_PRIVATE_KEY,
		});
		const userAuth: OAuthAppDeviceFlowAuthOptions = {
			type: 'oauth-user',
			async onVerification(verification: Verification): Promise<void> {
				await guildMember.send({ content: `Please enter code \`${verification.user_code}\` on page ${verification.verification_uri}` });
				Log.debug(`deviceCode: ${verification.device_code}, userCode: ${verification.user_code}, verificationUrl: ${verification.verification_uri}`);
			},
		};
		Log.debug('code entered on github page');
		
		const userAuthenticationFromDeviceFlow: OAuthAppAuthentication = await auth(userAuth);
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
		
		const userResult = await appOctokit.rest.users.getAuthenticated();
		
		Log.debug(`called authenticated user from API, githubID: ${userResult.data.id}, login: ${userResult.data.login}`);
		// Log.debug(userResult);
		
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
const askUnlinkGithubAccount = async (guildMember: GuildMember) => {
	const message: Message = await guildMember.send({
		content: 'Unlink/Remove github account?',
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId(buttonIds.GITHUB_ACCOUNT_UNLINK_APPROVE)
					.setLabel('Yes')
					.setStyle('SUCCESS'),
				new MessageButton()
					.setCustomId(buttonIds.GITHUB_ACCOUNT_UNLINK_REJECT)
					.setLabel('No')
					.setStyle('DANGER'),
			),
		],
	});
	await message.awaitMessageComponent({
		time: 600_000,
		filter: args => (args.customId == buttonIds.GITHUB_ACCOUNT_UNLINK_APPROVE || args.customId == buttonIds.GITHUB_ACCOUNT_UNLINK_REJECT)
			&& args.user.id == guildMember.id.toString(),
	}).then(async (interaction) => {
		if (interaction.customId == buttonIds.GITHUB_ACCOUNT_UNLINK_APPROVE) {
			const db: Db = await MongoDbUtils.connect(constants.DB_NAME);
			const accountsCollection: Collection<DiscordUserCollection> = db.collection(constants.DB_COLLECTION_DISCORD_USERS);
			
			Log.debug('looking for discord auth account');
			const result: DeleteResult = await accountsCollection.deleteOne({
				userId: guildMember.id.toString(),
			});
			if (result.deletedCount == 1) {
				Log.debug(`github account deleted for ${guildMember.id}`);
				await guildMember.send({ content: 'Github account removed!' });
			} else {
				Log.warn(`could not find github account to delete for ${guildMember.id}`);
			}
		} else if (interaction.customId == buttonIds.GITHUB_ACCOUNT_UNLINK_REJECT) {
			await guildMember.send({ content: 'You got it!' });
		}
	}).catch(error => {
		Log.error(error);
	}).finally(() => {
		message.edit({ components: [] }).catch(Log.error);
	});
};

export default VerifyGithub;