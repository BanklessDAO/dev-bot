import { CommandContext } from 'slash-create';
import { GuildMember } from 'discord.js';
import Log, { LogUtils } from '../../utils/Log';
import ServiceUtils from '../../utils/ServiceUtils';
import { Octokit } from '@octokit/rest';
import { retrieveVerifiedGithub } from './VerifyGithub';
import constants from '../constants/constants';

export type VerifiedGithub = {
	accessToken: string,
	id: number,
	email: string | null,
	username: string,
	profileUrl: string,
	avatarUrl: string,
};

const JoinGithubOrg = async (ctx: CommandContext, guildMember: GuildMember): Promise<void> => {
	Log.debug('starting to join github org');
	
	const isDmOn: boolean = await ServiceUtils.tryDMUser(guildMember, `Attempting to join ${constants.GITHUB_ORG}!`);
	await ctx.defer(true);
	
	if (!isDmOn) {
		await ctx.send({ content: 'Please turn on DMs and try again!', ephemeral: true });
		return;
	} else {
		await ctx.send({ content: 'DM sent!', ephemeral: true });
	}
	
	const githubAccount: VerifiedGithub = await retrieveVerifiedGithub(guildMember);
	
	if (githubAccount == null) {
		await guildMember.send({ content: 'Please verify github account with `/github verify`.' });
		return;
	}
	
	try {
		const userOctoKit: Octokit = new Octokit({ auth: githubAccount.accessToken });
		Log.debug('attempting to get membership status for authenticated user');
		
		const result: void | any = await userOctoKit.rest.orgs.getMembershipForAuthenticatedUser({ org: constants.GITHUB_ORG }).catch(e => {
			Log.warn(e);
		});
		
		if (result == null || result.data == null || result.data.state != 'active') {
			// TODO: integrate with Github App
			// const auth = createOAuthAppAuth({
			// 	clientId: apiKeys.GITHUB_CLIENT_ID,
			// 	clientSecret: apiKeys.GITHUB_CLIENT_SECRET,
			// 	clientType: 'oauth-app',
			// });
			// const appAuth: AppAuthentication = await auth({ type: 'oauth-app' });
			// const appOctokit: Octokit = new Octokit({ auth: appAuth.headers.authorization  });
			//
			// const invitationResult = await appOctokit.rest.orgs.createInvitation({ org: constants.GITHUB_ORG, invitee_id: githubAccount.id });
			// Log.debug(invitationResult);
			
			await guildMember.send({ content: 'Invite sent! Please check your email inbox.' });
			return;
		}
		Log.debug(result);
		await guildMember.send({ content: `Your membership in ${constants.GITHUB_ORG} is active.` });
	} catch (e) {
		Log.error(e);
		LogUtils.logError('failed to join github org', e);
		await ctx.send({ content: 'Please try command again.', ephemeral: true });
	}
};

export default JoinGithubOrg;