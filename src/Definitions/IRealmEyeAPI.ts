export interface IRealmEyeAPI {
    account_fame: number;
    account_fame_rank: number;
    /**
     * The public API cannot access most of the information here.
     */
    characters: IRealmEyeCharacters[];
    characters_hidden: boolean;
    chars: 1;
    desc1: string;
    desc2: string;
    desc3: string;
    donator: boolean;
    exp: number;
    exp_rank: number;
    fame: number;
    fame_rank: number;
    guild: string;
    guild_confirmed: boolean;
    guild_rank: string;
    player: string;
    /**
     * This is NOT available in the public API.
     */
    player_first_seen: string;
    player_last_seen: string;
    rank: number;
    skins: number;
    skins_rank: number   
}

export interface IRealmEyeCharacters  {
    backpack: boolean;
    character_dyes: {
        accessory_dye: string;
        clothing_dye: string;
        data_accessory_dye: number;
        data_clothing_dye: number
    };
    class: string;
    cqc: number;
    data_class_id: number;
    data_pet_id: number;
    data_skin_id: number;
    equips: []; // no equips?
    exp: number;
    fame: number;
    last_seen: string;
    last_server: string;
    level: number;
    pet: string;
    place: number;
    stats: {
        attack: number;
        defense: number;
        dexterity: number;
        hp: number;
        mp: number;
        speed: number;
        vitality: number;
        wisdom: number;
    };
    stats_maxed: number;
}