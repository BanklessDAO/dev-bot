import {
	Collection,
	ObjectId,
} from 'mongodb';

export interface DiscordUserCollection extends Collection {
	_id: ObjectId,
	userId: string,
	tag: string,
	github: {
		id: number,
		accessToken: string,
	},
}
