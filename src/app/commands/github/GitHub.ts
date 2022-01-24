import {
	CommandContext,
	CommandOptionType,
	SlashCommand,
	SlashCreator,
} from 'slash-create';
import Log, { LogUtils } from '../../utils/Log';
import discordServerIds from '../../service/constants/discordServerIds';
import VerifyGithub from '../../service/github/VerifyGithub';
import ServiceUtils from '../../utils/ServiceUtils';

export default class Help extends SlashCommand {
	constructor(creator: SlashCreator) {
		super(creator, {
			name: 'github',
			description: 'Commands to help automate, manage, and provide github access.',
			options: [
				{
					name: 'verify',
					type: CommandOptionType.SUB_COMMAND,
					description: 'Verify your github login.',
				},
			],
			throttling: {
				usages: 3,
				duration: 1,
			},
			defaultPermission: true,
			guildIDs: [discordServerIds.banklessDAO, discordServerIds.slinkypotatoe],
		});
	}
	
	async run(ctx: CommandContext): Promise<any> {
		LogUtils.logCommandStart(ctx);
		if (ctx.user.bot) return;
		
		const { guildMember } = await ServiceUtils.getGuildAndMember(ctx.guildID, ctx.user.id);
		
		try {
			switch (ctx.subcommands[0]) {
			case 'verify':
				await VerifyGithub(ctx, guildMember);
				break;
			default:
				await ctx.send({ content: 'Please try another command' }).catch(Log.error);
				break;
			}
		} catch (e) {
			LogUtils.logError('failed to verify user', e);
			await ServiceUtils.sendOutErrorMessage(ctx);
		}
	}
}