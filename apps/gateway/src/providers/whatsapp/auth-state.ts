import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "baileys";
import { collections } from "../../db.ts";

// Baileys session keys in MongoDB, one document per key. Keys are named exactly
// like useMultiFileAuthState's files (minus ".json"), so sessions imported from
// an auth folder keep working.

const fixKey = (key: string) => key.replace(/\//g, "__").replace(/:/g, "-");

export async function useMongoAuthState(instanceId: number): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
	const docId = (key: string) => `${instanceId}:${fixKey(key)}`;

	const read = async (key: string) => {
		const doc = await collections.auth.findOne({ _id: docId(key) });
		return doc ? JSON.parse(doc.value, BufferJSON.reviver) : null;
	};
	const write = async (key: string, value: unknown) => {
		await collections.auth.updateOne(
			{ _id: docId(key) },
			{ $set: { instanceId, value: JSON.stringify(value, BufferJSON.replacer) } },
			{ upsert: true },
		);
	};

	const creds: AuthenticationCreds = (await read("creds")) ?? initAuthCreds();

	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) => {
					const docs = await collections.auth.find({ _id: { $in: ids.map((id) => docId(`${type}-${id}`)) } }).toArray();
					const byId = new Map(docs.map((d) => [d._id, d.value]));
					const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
					for (const id of ids) {
						const raw = byId.get(docId(`${type}-${id}`));
						let value = raw ? JSON.parse(raw, BufferJSON.reviver) : undefined;
						if (type === "app-state-sync-key" && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
						data[id] = value;
					}
					return data;
				},
				set: async (data) => {
					const ops = [];
					for (const category in data) {
						const entries = data[category as keyof SignalDataTypeMap] ?? {};
						for (const id in entries) {
							const value = entries[id];
							const _id = docId(`${category}-${id}`);
							ops.push(
								value
									? { updateOne: { filter: { _id }, update: { $set: { instanceId, value: JSON.stringify(value, BufferJSON.replacer) } }, upsert: true } }
									: { deleteOne: { filter: { _id } } },
							);
						}
					}
					if (ops.length) await collections.auth.bulkWrite(ops, { ordered: false });
				},
			},
		},
		saveCreds: () => write("creds", creds),
	};
}

/** Wipes the session so the next start shows a fresh QR. */
export async function clearAuthState(instanceId: number): Promise<void> {
	await collections.auth.deleteMany({ instanceId });
}
