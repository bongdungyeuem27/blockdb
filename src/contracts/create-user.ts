import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schemas from "../../schemas/schemas";

const client = new SQL({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const db = drizzle(client, {
  schema: schemas,
});

await db.insert(schemas.profiles).values({
  username: "root",
  password: await Bun.password.hash("ftisu@2022"),
  isLoggedIn: false,
  // Generate an EVM-compatible private key (32 bytes, hex string)
  fernetKey: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "hex"
  ),
});
