import { config } from "./config.ts";
import { mongoClient } from "./db.ts";
import { createInstance, deleteInstance, listInstances, loadInstances, type InstanceRecord, type InstanceType } from "./store/instances.ts";

// Stand-in for GREEN-API's web console.
//   npm run cli -- create whatsapp "My test number"
//   npm run cli -- list
//   npm run cli -- delete 1101000001

const [command, ...args] = process.argv.slice(2);
const base = config.publicUrl || `http://${config.host}:${config.port}`;

function show(i: InstanceRecord) {
	const prefix = i.type === "whatsapp" ? "waInstance" : "tgInstance";
	console.log(`${i.id}  ${i.type.padEnd(8)}  ${i.name ?? ""}`);
	console.log(`  idInstance:       ${i.id}`);
	console.log(`  apiTokenInstance: ${i.token}`);
	console.log(`  apiUrl:           ${base}`);
	console.log(`  example:          GET ${base}/${prefix}${i.id}/getStateInstance/${i.token}`);
}

switch (command) {
	case "create": {
		const type = (args[0] ?? "whatsapp") as InstanceType;
		if (type !== "whatsapp" && type !== "telegram") throw new Error("type must be whatsapp or telegram");
		show(await createInstance(type, args[1]));
		break;
	}
	case "list":
		await loadInstances();
		for (const i of listInstances()) show(i);
		break;
	case "delete":
		await deleteInstance(Number(args[0]));
		console.log(`Deleted ${args[0]}. Restart the server so its worker stops.`);
		break;
	default:
		console.log("usage: npm run cli -- create [whatsapp|telegram] [name] | list | delete <id>");
}

await mongoClient.close();
