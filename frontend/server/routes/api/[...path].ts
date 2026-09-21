import { defineEventHandler, proxyRequest, readRawBody } from "h3";

export default defineEventHandler(async (event) => {
	const base = process.env.ENCORE_URL ?? "http://localhost:4000";
	const target =
		base + (event.url.pathname + event.url.search).replace(/^\/api/, "");
	const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(event.req.method);
	const body = hasBody ? await readRawBody(event) : undefined;

	return proxyRequest(
		event,
		target,
		body !== undefined ? { fetchOptions: { body } } : undefined,
	);
});
