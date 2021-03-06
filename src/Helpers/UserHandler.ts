import { User, GuildMember, Guild, Role, Message } from "discord.js";
import { IRaidGuild } from "../Templates/IRaidGuild";
import Collection from "@discordjs/collection";
import { StringUtil } from "../Utility/StringUtil";
import { Zero } from "../Zero";
import { GuildUtil } from "../Utility/GuildUtil";

export namespace UserHandler {
	/**
     * Checks to see if a member can get the "staff" role. The "staff" role is a role that all staff members will have.
     * @param {GuildMember} member The member.  
     * @param {IRaidGuild} guildData The guild data.
     * @returns {Promise<boolean>} Whether any changes were made. 
     */
	export async function manageStaffRole(member: GuildMember, guildData: IRaidGuild): Promise<boolean> {
		const teamRole: Role | undefined = member.guild.roles.cache.get(guildData.roles.teamRole);

		if (typeof teamRole === "undefined") {
			return false;
		}

		let staffRoles: string[] = [
			guildData.roles.moderator,
			guildData.roles.headRaidLeader,
			guildData.roles.officer,
			guildData.roles.universalRaidLeader,
			guildData.roles.universalAlmostRaidLeader,
			guildData.roles.support,
			guildData.roles.verifier,
			guildData.roles.pardonedRaidLeader
		];

		if (guildData.roles.customTeamRoles) {
			staffRoles.push(...guildData.roles.customTeamRoles);
		}

		// get each individual section rl roles
		for (const section of [GuildUtil.getDefaultSection(guildData), ...guildData.sections]) {
			staffRoles.push(section.roles.almostLeaderRole, section.roles.raidLeaderRole, section.roles.trialLeaderRole, section.roles.headLeaderRole);
		}

		const allStaffRoles: Role[] = [];
		for (const role of staffRoles) {
			if (member.guild.roles.cache.has(role)) {
				allStaffRoles.push(member.guild.roles.cache.get(role) as Role);
			}
		}

		for await (let role of allStaffRoles) {
			if (member.roles.cache.has(role.id)) {
				await member.roles.add(teamRole, `Has ${role.name} role.`)
					.catch(() => { });
				return true;
			}
		}

		await member.roles.remove(guildData.roles.teamRole, "No longer a staff member").catch(() => { });
		return true;
	}

	/**
	 * Fetches a user using the `<User>.fetch()` method, optionally fetching the member using the `<GuildMember>.fetch()` method if in a guild.
	 * @param {Guild | null} guild The guild, if applicable. 
	 * @param {string} target The target ID. 
	 * @returns {Promise<User | GuildMember | null>} A `User` object if not in a guild, a `GuildMember` object if in a guild, and `null` if the user isn't found. 
	 */
	export async function fetchUser(
		guild: Guild | null,
		target: string
	): Promise<User | GuildMember | null> {
		return new Promise((resolve) => {
			try {
				Zero.RaidClient.users.fetch(target).then(user => {
					if (guild !== null) {
						guild.members.fetch(user).then(member => {
							resolve(member);
						});
					}
					else {
						resolve(user);
					}
				});
			}
			catch (e) {
				resolve(null);
				return;
			}
		});
	}

	/**
	 * Finds a user or a set of users with similar names. 
	 * @param {Guild} guild The guild. 
	 * @param {string} target The IGN to look for.
	 * @param {IRaidGuild} guildDB The guild DB.
	 * @returns {GuildMember | GuildMember[]} The member or set of members.
	 */
	export function findUserByInGameName(
		guild: Guild,
		target: string,
		guildDB: IRaidGuild
	): GuildMember | GuildMember[] {
		// get raw name (excluding symbols)
		let nameToFind: string = target.toLowerCase().replace(/[^A-Za-z]/g, "");
		let possibleMembers: GuildMember[] = [];

		// get all members
		const members: Collection<string, GuildMember> = guild.members.cache.filter(c => c.roles.cache.has(guildDB.roles.raider) || c.roles.cache.has(guildDB.roles.suspended));
		for (let [, member] of members) {
			// in the case the person verified with multiple names
			let name: string[] = [];
			if (member.displayName.includes("|")) {
				name = member.displayName.split("|").map(x => x.toLowerCase().replace(/[^A-Za-z]/g, ""));
			}
			else {
				name = [member.displayName.toLowerCase().replace(/[^A-Za-z]/g, "")];
			}


			// loop through each name. 
			for (let i = 0; i < name.length; i++) {
				// check for strict equality 
				if (name[i] === nameToFind) {
					return member;
				}

				// check for partial equality 
				if (StringUtil.compareTwoStrings(name[i], nameToFind) >= 0.75) {
					possibleMembers.push(member);
				}
			}

		}
		return possibleMembers;
	}

	/**
	 * Finds a user. Does not need to be used in a guild.
	 * @param person The person to look for. This can either be an ID or mention.
	 */
	export async function resolveUserNoGuild(person: string): Promise<User | null> {
		const res: string | null = getUserFromMention(person);
		if (res !== null) {
			try {
				return await Zero.RaidClient.users.fetch(res);
			}
			catch (e) {
				return null;
			}
		}

		if (/^\d+$/.test(person)) {
			// this is an ID
			try {
				return await Zero.RaidClient.users.fetch(person);
			}
			catch (e) {
				return null;
			}
		}

		return null;
	}

	/**
	 * Finds a user. This will take in a message and only look at the FIRST argument provided. 
	 * @param {Message} msg The message. While there can be no content (this will return null), there should be at least one argument. The function will ONLY LOOK AT THE FIRST ARGUMENT provided.
	 * @param {IRaidGuild} guildDb The guild db. 
	 * @returns {Promise<GuildMember | null>} The member, if any. If no results, null.
	 */
	export async function resolveMember(msg: Message, guildDb: IRaidGuild): Promise<GuildMember | null> {
		const args: string[] = msg.content.split(/ +/);
		args.shift(); // this will be the command, not the mention
		if (args.length === 0) {
			return null;
		}
		const searchQuery: string = args[0];
		return internalResolveMember(msg.guild as Guild, guildDb, searchQuery);
	}

	/**
	 * Finds a user. This will take in a string and return the guild member. 
	 * @param {string} str The string content. This should contain a mention, IGN, or ID.
	 * @param {Guild} guild The guild.
	 * @param {IRaidGuild} guildDb The guild db. 
	 * @returns {Promise<GuildMember | null>} The member, if any. If no results, null.
	 */
	export async function resolveMemberWithStr(
		str: string, 
		guild: Guild, 
		guildDb: IRaidGuild
	): Promise<GuildMember | null> {
		return internalResolveMember(guild, guildDb, str);
	}

	/**
	 * Finds one or more users. This will take in an array of string(s) and return the associated guild members. 
	 * @param {string[]} arr The string array. Each element should contain a mention, IGN, or ID.
	 * @param {Guild} guild The guild.
	 * @param {IRaidGuild} guildDb The guild db. 
	 * @returns {Promise<GuildMember[]>} The members, if any.
	 */
	export async function resolveMultipleMembers(
		arr: string[], 
		guild: Guild, 
		guildDb: IRaidGuild
	): Promise<GuildMember[]> {
		const members: GuildMember[] = [];
		for await (const elem of arr) {
			const possibleMember: GuildMember | null = await internalResolveMember(guild, guildDb, elem);
			if (possibleMember !== null) {
				members.push(possibleMember);
			}
		}
		return members;
	}

	/**
	 * @param {string} mention The mention (string format). 
	 * @see https://discordjs.guide/miscellaneous/parsing-mention-arguments.html#using-regular-expressions
	 */
	export function getUserFromMention(mention: string): string | null {
		// The id is the first and only match found by the RegEx.
		const matches: RegExpMatchArray | null = mention.match(/^<@!?(\d+)>$/);

		// If supplied variable was not a mention, matches will be null instead of an array.
		if (matches === null) {
			return null;
		}

		// However the first element in the matches array will be the entire mention, not just the ID,
		// so use index 1.
		const id: string = matches[1];
		return id;
	}

	/**
	 * Finds a user. This will take in a string and return the guild member. 
	 * @param {Guild} guild The guild. 
	 * @param {IRaidGuild} guildDb The guild db. 
	 * @param {string} searchQuery The person to search.
	 * @returns {Promise<GuildMember | null>} The member, if any. If no results, null.
	 */
	async function internalResolveMember(
		guild: Guild, 
		guildDb: IRaidGuild, 
		searchQuery: string
	): Promise<GuildMember | null> {
		const res: string | null = getUserFromMention(searchQuery);
		if (res !== null) {
			try {
				return await guild.members.fetch(res);
			}
			catch (e) {
				return null;
			}
		}

		if (/^\d+$/.test(searchQuery)) {
			// this is an ID
			try {
				return await guild.members.fetch(searchQuery);
			}
			catch (e) {
				return null;
			}
		}

		const nameSearchResults: GuildMember | GuildMember[] = findUserByInGameName(guild, searchQuery, guildDb);
		if (!Array.isArray(nameSearchResults)) {
			return nameSearchResults;
		}

		return null;
	}
}