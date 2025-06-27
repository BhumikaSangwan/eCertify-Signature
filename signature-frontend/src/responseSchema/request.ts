import Zod from "zod";

export const requestCreationSchema = Zod.object({
	id: Zod.string(),
});

export const requestSchema = Zod.object({
	_id: Zod.string(),
	id: Zod.string(),
	title: Zod.string(),
	officer: Zod.string(),
	status: Zod.number(),
});


export const RequestSchemaForUsers = requestSchema;
