/**
 * True -- uses production settings.
 * False -- uses testing settings.
 */
const PRODUCTION_BOT: boolean = false;

/**
 * The bot token.
 */
export const Credentials: IConfigurationSettings = PRODUCTION_BOT
    ? {
        token: "",
        dbURL: "",
        dbName: "",
        userCollectionName: "",
        guildCollectionName: ""
    } : {
        token: "",
        dbURL: "",
        dbName: "",
        userCollectionName: "",
        guildCollectionName: ""
    };

/**
 * The default prefix for the bot.
 */
export const DefaultPrefix: string = ";";

/**
 * How long notification embeds should last before they are deleted. This should be in milliseconds.
 */
export const DeleteEmbedTime: number = 5000;

/**
 * Configuration Interface. Do not alter unless you know what you are doing.
 */
interface IConfigurationSettings {
    /**
     * The token for the bot.
     * @type {string}
     */
    token: string;
    /**
     * URL that the bot will connect to.
     *  @type {string}
     */
    dbURL: string;
    /**
     * The database name to use for MongoDB.
     * 
     * @type {string} 
     */
    dbName: string;
    /**
     * The user collection name. 
     * 
     * @type {string} 
     */
    userCollectionName: string;
    /**
     * The guild collection name. 
     * 
     * @type {string}
     */
    guildCollectionName: string;
}