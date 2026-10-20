// JSON is parsed at the transport boundary, then validated by each operation's schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = Record<string, any>;
export async function readJson(response:Response):Promise<JsonObject>{return await response.json() as JsonObject;}
