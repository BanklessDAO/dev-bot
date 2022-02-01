/**
 * Utilities for service layer
 */
import {
	Guild,
	GuildMember,
} from 'discord.js';
import Log from './Log';
import client from '../app';
import {
	CommandContext,
	ComponentActionRow,
	ComponentType,
} from 'slash-create';

const ServiceUtils = {
	async tryDMUser(guildMember: GuildMember, message: string): Promise<boolean> {
		try {
			await guildMember.send({ content: message });
			return true;
		} catch (e) {
			Log.warn(`DM is turned off for ${guildMember.user.tag}`);
			return false;
		}
	},
	async getGuildAndMember(guildId: string, userId: string): Promise<{ guild: Guild, guildMember: GuildMember }> {
		const guild = await client.guilds.fetch(guildId);
		return {
			guild: guild,
			guildMember: await guild.members.fetch(userId),
		};
	},
	sendOutErrorMessage: async (ctx: CommandContext, msg?: string): Promise<any> => {
		const row: ComponentActionRow = {
			type: ComponentType.ACTION_ROW,
			components: [],
		};
		try {
			await ctx.send({
				content: msg ? msg : 'Something is not working. Please reach out to DevOps for help!',
				ephemeral: true,
				components: [row],
			}).catch(Log.error);
		} catch (e) {
			Log.error(e);
		}
	},
};

export default ServiceUtils;
