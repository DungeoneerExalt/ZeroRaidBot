import { Command } from "../../Templates/Command/Command";
import { CommandDetail } from "../../Templates/Command/CommandDetail";
import { CommandPermission } from "../../Templates/Command/CommandPermission";
import { Message, Guild, MessageEmbed, EmojiResolvable, GuildEmoji, ReactionEmoji, Collection, GuildMember, Role, Emoji } from "discord.js";
import { IRaidGuild } from "../../Templates/IRaidGuild";
import { FastReactionMenuManager } from "../../Classes/Reaction/FastReactionMenuManager";
import { TimeUnit } from "../../Definitions/TimeUnit";
import { IRaidUser } from "../../Templates/IRaidUser";
import { MongoDbHelper } from "../../Helpers/MongoDbHelper";
import { GenericMessageCollector } from "../../Classes/Message/GenericMessageCollector";
import { InsertOneWriteOpResult, WithId } from "mongodb";
import { StringBuilder } from "../../Classes/String/StringBuilder";
import { UserHandler } from "../../Helpers/UserHandler";

export class AdminProfileUpdaterCommand extends Command {
	public constructor() {
		super(
			new CommandDetail(
				"Administrator Profile Updater Command",
				"adminprofileupdater",
				[],
				"Allows administrators to check profiles, create new profiles, and more.",
				["adminprofileupdater"],
				["adminprofileupdater"],
				0
			),
			new CommandPermission(
				["ADMINISTRATOR"],
				["MANAGE_NICKNAMES", "MANAGE_GUILD"],
				[],
				[],
				false
			),
			true,
			false,
			true
		);
	}

	public async executeCommand(
		msg: Message,
		args: string[],
		guildDb: IRaidGuild
	): Promise<void> {
		const introEmbed: MessageEmbed = new MessageEmbed()
			.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
			.setTitle("**Administrator: Profile Manager**")
			.setDescription("Use this command to make changes, such as creating a new profile, editing someone's profile, and more.\n\n⚠️ You are accessing an owner-only command as this command has the potential to harm the integrity of the user profile check. As such, usage of this command may be monitored. Any form of abuse will result in consequences.")
			.addField("Force-Sync Members/DB", "React with 🔄 to force-sync the database with all current __verified__ (Suspended & Verified) members. The bot will give anyone that doesn't have an entry in the database but is verified in the server a new entry in the database. Note that the bot will first show you the changes that will be made and then ask you to confirm those changes.")
			.addField("Add Profile to Database", "React with 🔼 to add a profile to the database. You will be asked to mention a person. Then, you will be asked to provide an in-game name.")
			.addField("Remove Profile from Database", "React with 🔽 to remove a profile from the database. The profile will be completely wiped from the database. Bear in mind that the person will NOT be unverified but will not be able to access numerous commands.")
			.addField("Edit User Profile", "React with 📩 to edit a user's profile. This will allow you to add, remove, or edit a person's main IGN and/or alternative IGN(s) and make changes to the current Discord ID that is logged.")
			.addField("Exit Process", "React with ❌ to exit the process. The menu will be closed and will not be accessible unless the command is used again.")
			.setColor("RED")
			.setFooter("Administrator: Profile Updater");
		const botMsg: Message = await msg.channel.send(introEmbed);
		const reactions: EmojiResolvable[] = ["🔄", "🔼", "🔽", "📩", "❌"];
		const selectedReaction: GuildEmoji | ReactionEmoji | "TIME" = await new FastReactionMenuManager(
			botMsg,
			msg.author,
			reactions,
			5,
			TimeUnit.MINUTE
		).react();

		if (selectedReaction === "TIME") {
			return;
		}

		if (selectedReaction.name === "❌") {
			await botMsg.delete().catch(e => { });
			return;
		}

		if (selectedReaction.name === "🔄") {
			this.forceSyncCmd(msg, botMsg, guildDb);
			return;
		}
		else if (selectedReaction.name === "🔼") {
			// TODO
			return;
		}
		else if (selectedReaction.name === "🔽") {
			// TODO
			return;
		}
		else if (selectedReaction.name === "📩") {
			// TODO
			return;
		}
	}

	private async forceSyncCmd(msg: Message, botMsg: Message, guildData: IRaidGuild): Promise<void> {
		const guild: Guild = msg.guild as Guild;
		const verifiedRole: Role | undefined = guild.roles.cache.get(guildData.roles.raider);
		const suspendedRole: Role | undefined = guild.roles.cache.get(guildData.roles.suspended);

		if (typeof verifiedRole === "undefined") {
			const editedMsg: Message = await botMsg.edit(this.getNoVerifiedRoleEmbed(msg));
			await editedMsg.delete({ timeout: 5000 });
			return;
		}

		const rolesToHave: string[] = [verifiedRole.id];
		if (typeof suspendedRole !== "undefined") {
			rolesToHave.push(suspendedRole.id);
		}

		// check which members do not have a db entry 
		const allUsersInDb: IRaidUser[] = await MongoDbHelper.MongoDbUserManager.MongoUserClient.find({}).toArray();
		const allMembers: Collection<string, GuildMember> = (await guild.members.fetch())
			.filter(member => rolesToHave.some(role => member.roles.cache.has(role)))
			.filter(member => !member.user.bot)
		const membersWithNoDbEntry: [GuildMember, string[]][] = [];

		for (const [id, member] of allMembers) {
			const indexInDbArr: number = allUsersInDb.findIndex(x => x.discordUserId === id);
			if (indexInDbArr === -1) {
				const ign: string[] = member.displayName
					.split("|")
					.map(x => x.trim().replace(/[^A-Za-z]/g, ""));

				membersWithNoDbEntry.push([member, ign]);
			}
		}

		// now make sure we actually have members
		const noOneToAddEmbed: MessageEmbed = new MessageEmbed()
			.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
			.setTitle("All Synced")
			.setDescription("All verified members in this server have a profile. You don't need to do anything!")
			.setFooter(`${allMembers.size} Total Verified Members Checked`)
			.setColor("GREEN");

		if (membersWithNoDbEntry.length === 0) {
			const editedMsg: Message = await botMsg.edit(noOneToAddEmbed);
			await editedMsg.delete({ timeout: 5000 });
			return;
		}

		// we have members
		let reactToMsg: boolean = true;
		// see who to remove
		while (true) {
			const memberToGiveProfileEmbed: MessageEmbed = new MessageEmbed()
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setTitle("Members With No Profile")
				.setDescription("The members below are verified in this server but do not have a profile logged with the bot. The mention is shown first, along with any corresponding IGNs. The first IGN is the main IGN, and any other IGNs will be the alternative IGN.\n\n**DIRECTIONS:** The members shown below will have a profile created for them. Type the number corresponding to the member(s) that you do NOT want to have a profile created for.\n\n**FINISHED?** React with the ✅ to begin the syncing process. React with the ❌ to cancel this process completely.");

			// TODO use the format here for other list-based embeds
			let str: string = "";
			let altAdded: boolean = false;
			for (let i = 0; i < membersWithNoDbEntry.length; i++) {
				const tempStr: string = `**\`[${i + 1}]\`** ${membersWithNoDbEntry[i][0]}\n⇒ IGN(s): ${membersWithNoDbEntry[i][1].join(", ")}\n\n`
				if (str.length + tempStr.length > 1020) {
					memberToGiveProfileEmbed.addField("No Profile", tempStr);
					str = tempStr;
					altAdded = true;
				}
				else {
					altAdded = false;
					str += tempStr;
				}
			}

			if (!altAdded) {
				memberToGiveProfileEmbed.addField("No Profile", str);
			}

			await botMsg.edit(memberToGiveProfileEmbed).catch(e => { });

			const response: number | Emoji | "CANCEL" | "TIME" = await new GenericMessageCollector<number>(
				msg,
				{ embed: memberToGiveProfileEmbed },
				2,
				TimeUnit.MINUTE
			).sendWithReactCollector(GenericMessageCollector.getNumber(msg.channel, 1), {
				reactions: ["✅", "❌"],
				cancelFlag: "-cancel",
				reactToMsg: reactToMsg,
				deleteMsg: false,
				removeAllReactionAfterReact: false,
				oldMsg: botMsg
			});

			if (reactToMsg) {
				reactToMsg = false;
			}

			if (response instanceof Emoji) {
				if (response.name === "❌") {
					await botMsg.delete().catch(e => { });
					return;
				}
				else {
					break;
				}
			}
			else {
				if (response === "CANCEL" || response === "TIME") {
					await botMsg.delete().catch(e => { });
					return;
				}

				const index: number = response - 1;
				if (0 <= index && index < membersWithNoDbEntry.length) {
					membersWithNoDbEntry.splice(index, 1);
					if (membersWithNoDbEntry.length === 0) {
						const editedMsg: Message = await botMsg.edit(noOneToAddEmbed);
						await editedMsg.delete({ timeout: 5000 });
						return;
					}
				}
			}
		}

		// now create entries
		let amtAdded: number = 0;
		for await (const [member, igns] of membersWithNoDbEntry) {
			const mainIgn: string = igns[0];
			igns.splice(0, 1);
			const altIgns: {
				displayName: string;
				lowercase: string;
			}[] = [];
			for (const ign of igns) {
				altIgns.push({
					displayName: ign,
					lowercase: ign.toLowerCase()
				});
			}

			try {
				await MongoDbHelper.MongoDbUserManager.MongoUserClient.insertOne({
					discordUserId: member.id,
					rotmgDisplayName: mainIgn,
					rotmgLowercaseName: mainIgn.toLowerCase(),
					otherAccountNames: altIgns,
					lastModified: new Date().getTime(),
					general: {
						keyPops: [],
						voidVials: [],
						wcOryx: [],
						completedRuns: [],
						leaderRuns: [],
						moderationHistory: []
					}
				});
				amtAdded++;
			}
			catch (e) { }
		}

		const finalEmbed: MessageEmbed = new MessageEmbed()
			.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
			.setColor("GREEN")
			.setTitle("Sync Completed")
			.setDescription(`${amtAdded}/${membersWithNoDbEntry.length} accounts were successfully synced.`)
			.setFooter("Process Completed.")
			.setTimestamp();
		await botMsg.edit(finalEmbed);
		await botMsg.delete({ timeout: 5000 }).catch(e => { });
	}

	private async addProfileCmd(msg: Message, botMsg: Message, guildData: IRaidGuild): Promise<void> {
		const guild: Guild = msg.guild as Guild;
		const verifiedRole: Role | undefined = guild.roles.cache.get(guildData.roles.raider);
		const suspendedRole: Role | undefined = guild.roles.cache.get(guildData.roles.suspended);

		if (typeof verifiedRole === "undefined") {
			const editedMsg: Message = await botMsg.edit(this.getNoVerifiedRoleEmbed(msg));
			await editedMsg.delete({ timeout: 5000 });
			return;
		}

		const memberForProfile: GuildMember | "CANCEL" = await this.getPerson(msg, botMsg, guildData);
		if (memberForProfile === "CANCEL") {
			await botMsg.delete().catch(e => { });
			return;
		}

		const dbProfile: IRaidUser | null = await MongoDbHelper.MongoDbUserManager.MongoUserClient
			.findOne({ discordUserId: memberForProfile.id });

		const responseEmbed: MessageEmbed = new MessageEmbed()
			.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
			.setColor("GREEN")
			.setFooter("Administrator: Add Profile");

		if (dbProfile !== null) {
			responseEmbed.setTitle("Profile Already Exists!")
				.setDescription(`${memberForProfile} already has a profile!`);
			await botMsg.edit(responseEmbed).catch(e => { });
			await botMsg.delete({ timeout: 5000 }).catch(e => { });
			return;
		}

		let ignToUse: string = "";
		let reactToMsg: boolean = true;
		while (true) {
			const sb: StringBuilder = new StringBuilder()
				.append(`Set In-Game Name: ${ignToUse === "" ? "N/A" : ignToUse}`)
				.appendLine()
				.appendLine()
				.append(`**DIRECTIONS:** Please type an in-game name that you want to associate with ${memberForProfile}'s profile. The in-game name must be at least one letter long and no longer than ten letters. There must not be any symbols.`)
				.appendLine()
				.appendLine()
				.append("**FINISHED?** React with the ✅ to use the IGN specified above for the member. This will create the profile. React with the ❌ to cancel this process completely.");

			const ignEmbed: MessageEmbed = new MessageEmbed()
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setColor("GREEN")
				.setTitle("Provide In-Game Name")
				.setDescription(sb.toString())
				.setFooter("Administrator: Add Profile");

			await botMsg.edit(ignEmbed).catch(e => { });

			const response: string | Emoji | "CANCEL" | "TIME" = await new GenericMessageCollector<string>(
				msg,
				{ embed: ignEmbed },
				2,
				TimeUnit.MINUTE
			).sendWithReactCollector(GenericMessageCollector.getStringPrompt(msg.channel), {
				reactions: ["✅", "❌"],
				cancelFlag: "-cancel",
				reactToMsg: reactToMsg,
				deleteMsg: false,
				removeAllReactionAfterReact: false,
				oldMsg: botMsg
			});

			if (reactToMsg) {
				reactToMsg = !reactToMsg;
			}

			if (response instanceof Emoji) {
				if (response.name === "✅" && ignToUse !== "") {
					break;
				}

				if (response.name === "❌") {
					await botMsg.delete().catch(e => { });
					return;
				}
			}
			else {
				if (response === "TIME" || response === "CANCEL") {
					await botMsg.delete().catch(e => { });
					return;
				}

				
			}
		}
	}

	private getNoVerifiedRoleEmbed(msg: Message): MessageEmbed {
		return new MessageEmbed()
			.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
			.setTitle("No Verified Role")
			.setDescription("Your server does not have a Member role. As such, this command cannot be used.")
			.setFooter("Process Canceled")
			.setColor("RED");
	}

	private async getPerson(msg: Message, botMsg: Message, guildData: IRaidGuild): Promise<GuildMember | "CANCEL"> {
		const guild: Guild = msg.guild as Guild;
		let memberToGenerateProfileFor: GuildMember | undefined;

		let reactToMsg: boolean = true;
		while (true) {
			const sb: StringBuilder = new StringBuilder()
				.append(`You have currently selected: ${typeof memberToGenerateProfileFor === "undefined" ? "N/A" : memberToGenerateProfileFor}`)
				.appendLine()
				.appendLine()
				.append("**DIRECTIONS:** To select a person, either mention him or her, type his or her ID, or type his or her in-game name. The person must be verified (either with the Suspended role or Verified Member role) in order for this to work.")
				.appendLine()
				.appendLine()
				.append("**FINISHED?** React with the ✅ to use the member specified above. React with the ❌ to cancel this process completely.");

			const embed: MessageEmbed = new MessageEmbed()
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setTitle("**Select Member**")
				.setFooter("Administrator: Profile Syncer")
				.setDescription(sb.toString())

			await botMsg.edit(embed).catch(e => { });

			const response: string | Emoji | "CANCEL" | "TIME" = await new GenericMessageCollector<string>(
				msg,
				{ embed: embed },
				2,
				TimeUnit.MINUTE
			).sendWithReactCollector(GenericMessageCollector.getStringPrompt(msg.channel), {
				reactions: ["✅", "❌"],
				cancelFlag: "-cancel",
				reactToMsg: reactToMsg,
				deleteMsg: false,
				removeAllReactionAfterReact: false,
				oldMsg: botMsg
			});

			if (reactToMsg) {
				reactToMsg = !reactToMsg;
			}

			if (response instanceof Emoji) {
				if (response.name === "✅" && typeof memberToGenerateProfileFor !== "undefined") {
					return memberToGenerateProfileFor;
				}

				if (response.name === "❌") {
					return "CANCEL";
				}
			}
			else {
				if (response === "TIME" || response === "CANCEL") {
					return "CANCEL";
				}

				const resolvedMember: GuildMember | null = await UserHandler
					.resolveMemberWithStr(response, guild, guildData);

				if (resolvedMember !== null) {
					memberToGenerateProfileFor = resolvedMember;
				}
			}
		}
	}
}