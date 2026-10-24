// GREEN-API's exact error bodies are not part of the SDK contract (the SDK only
// surfaces status + JSON). These shapes are our approximation.
export class ApiError extends Error {
	constructor(
		readonly statusCode: number,
		message: string,
	) {
		super(message);
	}
}

export const badRequest = (message: string) => new ApiError(400, message);
