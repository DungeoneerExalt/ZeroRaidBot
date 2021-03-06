import { Client, Message, MessageReaction, User, PartialUser, GuildMember, PartialGuildMember, Guild, ClientUser, Channel, PartialDMChannel, Role, PartialMessage, VoiceState } from "discord.js";
import { MongoDbHelper } from "./Helpers/MongoDbHelper";
import { CommandManager } from "./Classes/CommandManager";
import axios, { AxiosInstance } from "axios";
import { onReadyEvent } from "./Events/ReadyEvent";
import { onMessageEvent } from "./Events/MessageEvent";
import { onMessageReactionAdd } from "./Events/MessageReactionAddEvent";
import { onMessageReactionRemove } from "./Events/MessageReactionRemoveEvent";
import { onGuildMemberAdd } from "./Events/GuildMemberAddEvent";
import { onGuildCreate } from "./Events/GuildCreateEvent";
import { onGuildMemberUpdate } from "./Events/GuildMemberUpdateEvent";
import { onError } from "./Events/ErrorEvent";
import { onChannelDelete } from "./Events/GuildChannelDeleteEvent";
import { PRODUCTION_BOT } from "./Configuration/Config";
import { onGuildMemberRemove } from "./Events/GuildMemberRemoveEvent";
import { onChannelCreate } from "./Events/GuildChannelCreateEvent";
import { onRoleDelete } from "./Events/RoleDeleteEvent";
import { IRaidUser } from "./Templates/IRaidUser";
import { onMessageDeleteEvent } from "./Events/MessageDeleteEvent";
import { onVoiceStateUpdate } from "./Events/VoiceStateUpdateEvent";

export class Zero {
	/** 
	 * The bot client.
	 */
	public static readonly RaidClient: Client = new Client({ 
		partials: [
			"MESSAGE", 
			"CHANNEL", 
			"REACTION"
		],
		restTimeOffset: 350
	});

	/**
	 * The token for the bot.
	 */
	private readonly _token: string;

	/**
	 * The command manager object.
	 */
	public static readonly CmdManager: CommandManager = new CommandManager();

	/**
	 * The AxiosInstance, which will be used to make requests to RealmEye.
	 */
	public static readonly AxiosClient: AxiosInstance = axios.create();

	/**
	 * The user database. 
	 */
	public static UserDatabase: IRaidUser[] = [];

	/**
	 * The contructor for this method.
	 * 
	 * There should only be ONE `Zero` object per instance.
	 *  
	 * @param {string} token The token. 
	 */
	public constructor(token: string) {
		// initialize vars as usual
		this._token = token;
		// load all bot commands.
		Zero.CmdManager.loadAllCommands();

		// events
		Zero.RaidClient
			.on("ready", () => onReadyEvent());
		Zero.RaidClient
			.on("message", async (msg: Message) => await onMessageEvent(msg));
		Zero.RaidClient
			.on("messageReactionAdd", async (reaction: MessageReaction, user: User | PartialUser) => await onMessageReactionAdd(reaction, user));
		Zero.RaidClient
			.on("messageReactionRemove", async (reaction: MessageReaction, user: User | PartialUser) => await onMessageReactionRemove(reaction, user));
		Zero.RaidClient
			.on("guildMemberAdd", async (member: GuildMember | PartialGuildMember) => await onGuildMemberAdd(member));
		Zero.RaidClient
			.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => await onGuildMemberRemove(member));
		Zero.RaidClient
			.on("guildCreate", async (guild: Guild) => await onGuildCreate(guild));
		Zero.RaidClient
			.on("guildMemberUpdate", async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember) => await onGuildMemberUpdate(oldMember, newMember));
		Zero.RaidClient
			.on("error", async (error: Error) => onError(error));
		Zero.RaidClient
			.on("channelDelete", async (channel: Channel | PartialDMChannel) => await onChannelDelete(channel));
		Zero.RaidClient
			.on("channelCreate", async (channel: Channel | PartialDMChannel) => await onChannelCreate(channel));
		Zero.RaidClient
			.on("roleDelete", async (role: Role) => await onRoleDelete(role));
		Zero.RaidClient
			.on("messageDelete", async (msg: Message | PartialMessage) => await onMessageDeleteEvent(msg));
		Zero.RaidClient
			.on("voiceStateUpdate", async (oldV: VoiceState, newV: VoiceState) => await onVoiceStateUpdate(oldV, newV));

		// testing
		if (!PRODUCTION_BOT) {
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
		}
	}

	/**
	 * Logs into the client. This method should be called first. If this method call is successful, the bot will also attempt to connect to MongoDB.
	 */
	public async login(): Promise<void> {
		try {
			const mdm: MongoDbHelper.MongoDbBase = new MongoDbHelper.MongoDbBase();
			await mdm.connect();
			await Zero.RaidClient.login(this._token);
			(Zero.RaidClient.user as ClientUser).setActivity("my soul dying.", { type: "WATCHING" });
			this.startServices();
		}
		catch (e) {
			throw new ReferenceError(e);
		}
	}

	private _startedServices: boolean = false; 

	/**
	 * Starts any applicable services.
	 */
	private async startServices(): Promise<void> {
		if (this._startedServices) {
			return;
		}

		this._startedServices = true;
		
		// check user db every 10 min
		setInterval(async () => {
			Zero.UserDatabase = await MongoDbHelper.MongoDbUserManager.MongoUserClient.find({}).toArray();
		}, 10 * 60 * 1000); 
	}
}