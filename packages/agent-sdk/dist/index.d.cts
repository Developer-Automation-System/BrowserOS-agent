type Primitive = string | number | symbol | bigint | boolean | null | undefined;
declare const ZodParsedType: {
	string: "string";
	nan: "nan";
	number: "number";
	integer: "integer";
	float: "float";
	boolean: "boolean";
	date: "date";
	bigint: "bigint";
	symbol: "symbol";
	function: "function";
	undefined: "undefined";
	null: "null";
	array: "array";
	object: "object";
	unknown: "unknown";
	promise: "promise";
	void: "void";
	never: "never";
	map: "map";
	set: "set";
};
type ZodParsedType = keyof typeof ZodParsedType;
type allKeys<T> = T extends any ? keyof T : never;
type typeToFlattenedError<
	T,
	U = string
> = {
	formErrors: U[];
	fieldErrors: { [P in allKeys<T>]? : U[] };
};
declare const ZodIssueCode: {
	invalid_type: "invalid_type";
	invalid_literal: "invalid_literal";
	custom: "custom";
	invalid_union: "invalid_union";
	invalid_union_discriminator: "invalid_union_discriminator";
	invalid_enum_value: "invalid_enum_value";
	unrecognized_keys: "unrecognized_keys";
	invalid_arguments: "invalid_arguments";
	invalid_return_type: "invalid_return_type";
	invalid_date: "invalid_date";
	invalid_string: "invalid_string";
	too_small: "too_small";
	too_big: "too_big";
	invalid_intersection_types: "invalid_intersection_types";
	not_multiple_of: "not_multiple_of";
	not_finite: "not_finite";
};
type ZodIssueCode = keyof typeof ZodIssueCode;
type ZodIssueBase = {
	path: (string | number)[];
	message?: string | undefined;
};
interface ZodInvalidTypeIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_type;
	expected: ZodParsedType;
	received: ZodParsedType;
}
interface ZodInvalidLiteralIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_literal;
	expected: unknown;
	received: unknown;
}
interface ZodUnrecognizedKeysIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.unrecognized_keys;
	keys: string[];
}
interface ZodInvalidUnionIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_union;
	unionErrors: ZodError[];
}
interface ZodInvalidUnionDiscriminatorIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_union_discriminator;
	options: Primitive[];
}
interface ZodInvalidEnumValueIssue extends ZodIssueBase {
	received: string | number;
	code: typeof ZodIssueCode.invalid_enum_value;
	options: (string | number)[];
}
interface ZodInvalidArgumentsIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_arguments;
	argumentsError: ZodError;
}
interface ZodInvalidReturnTypeIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_return_type;
	returnTypeError: ZodError;
}
interface ZodInvalidDateIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_date;
}
type StringValidation = "email" | "url" | "emoji" | "uuid" | "nanoid" | "regex" | "cuid" | "cuid2" | "ulid" | "datetime" | "date" | "time" | "duration" | "ip" | "cidr" | "base64" | "jwt" | "base64url" | {
	includes: string;
	position?: number | undefined;
} | {
	startsWith: string;
} | {
	endsWith: string;
};
interface ZodInvalidStringIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_string;
	validation: StringValidation;
}
interface ZodTooSmallIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.too_small;
	minimum: number | bigint;
	inclusive: boolean;
	exact?: boolean;
	type: "array" | "string" | "number" | "set" | "date" | "bigint";
}
interface ZodTooBigIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.too_big;
	maximum: number | bigint;
	inclusive: boolean;
	exact?: boolean;
	type: "array" | "string" | "number" | "set" | "date" | "bigint";
}
interface ZodInvalidIntersectionTypesIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.invalid_intersection_types;
}
interface ZodNotMultipleOfIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.not_multiple_of;
	multipleOf: number | bigint;
}
interface ZodNotFiniteIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.not_finite;
}
interface ZodCustomIssue extends ZodIssueBase {
	code: typeof ZodIssueCode.custom;
	params?: {
		[k: string]: any;
	};
}
type ZodIssueOptionalMessage = ZodInvalidTypeIssue | ZodInvalidLiteralIssue | ZodUnrecognizedKeysIssue | ZodInvalidUnionIssue | ZodInvalidUnionDiscriminatorIssue | ZodInvalidEnumValueIssue | ZodInvalidArgumentsIssue | ZodInvalidReturnTypeIssue | ZodInvalidDateIssue | ZodInvalidStringIssue | ZodTooSmallIssue | ZodTooBigIssue | ZodInvalidIntersectionTypesIssue | ZodNotMultipleOfIssue | ZodNotFiniteIssue | ZodCustomIssue;
type ZodIssue = ZodIssueOptionalMessage & {
	fatal?: boolean | undefined;
	message: string;
};
type recursiveZodFormattedError<T> = T extends [any, ...any[]] ? { [K in keyof T]? : ZodFormattedError<T[K]> } : T extends any[] ? {
	[k: number]: ZodFormattedError<T[number]>;
} : T extends object ? { [K in keyof T]? : ZodFormattedError<T[K]> } : unknown;
type ZodFormattedError<
	T,
	U = string
> = {
	_errors: U[];
} & recursiveZodFormattedError<NonNullable<T>>;
declare class ZodError<T = any> extends Error {
	issues: ZodIssue[];
	get errors(): ZodIssue[];
	constructor(issues: ZodIssue[]);
	format(): ZodFormattedError<T>;
	format<U>(mapper: (issue: ZodIssue) => U): ZodFormattedError<T, U>;
	static create: (issues: ZodIssue[]) => ZodError<any>;
	static assert(value: unknown): asserts value is ZodError;
	toString(): string;
	get message(): string;
	get isEmpty(): boolean;
	addIssue: (sub: ZodIssue) => void;
	addIssues: (subs?: ZodIssue[]) => void;
	flatten(): typeToFlattenedError<T>;
	flatten<U>(mapper?: (issue: ZodIssue) => U): typeToFlattenedError<T, U>;
	get formErrors(): typeToFlattenedError<T, string>;
}
type stripPath<T extends object> = T extends any ? util.OmitKeys<T, "path"> : never;
type IssueData = stripPath<ZodIssueOptionalMessage> & {
	path?: (string | number)[];
	fatal?: boolean | undefined;
};
type ErrorMapCtx = {
	defaultError: string;
	data: any;
};
type ZodErrorMap = (issue: ZodIssueOptionalMessage, _ctx: ErrorMapCtx) => {
	message: string;
};
type ParseParams = {
	path: (string | number)[];
	errorMap: ZodErrorMap;
	async: boolean;
};
type ParsePathComponent = string | number;
type ParsePath = ParsePathComponent[];
interface ParseContext {
	readonly common: {
		readonly issues: ZodIssue[];
		readonly contextualErrorMap?: ZodErrorMap | undefined;
		readonly async: boolean;
	};
	readonly path: ParsePath;
	readonly schemaErrorMap?: ZodErrorMap | undefined;
	readonly parent: ParseContext | null;
	readonly data: any;
	readonly parsedType: ZodParsedType;
}
type ParseInput = {
	data: any;
	path: (string | number)[];
	parent: ParseContext;
};
declare class ParseStatus {
	value: "aborted" | "dirty" | "valid";
	dirty(): void;
	abort(): void;
	static mergeArray(status: ParseStatus, results: SyncParseReturnType<any>[]): SyncParseReturnType;
	static mergeObjectAsync(status: ParseStatus, pairs: {
		key: ParseReturnType<any>;
		value: ParseReturnType<any>;
	}[]): Promise<SyncParseReturnType<any>>;
	static mergeObjectSync(status: ParseStatus, pairs: {
		key: SyncParseReturnType<any>;
		value: SyncParseReturnType<any>;
		alwaysSet?: boolean;
	}[]): SyncParseReturnType;
}
type INVALID = {
	status: "aborted";
};
type DIRTY<T> = {
	status: "dirty";
	value: T;
};
type OK<T> = {
	status: "valid";
	value: T;
};
type SyncParseReturnType<T = any> = OK<T> | DIRTY<T> | INVALID;
type AsyncParseReturnType<T> = Promise<SyncParseReturnType<T>>;
type ParseReturnType<T> = SyncParseReturnType<T> | AsyncParseReturnType<T>;
/**
* The Standard Schema interface.
*/
type StandardSchemaV1<
	Input = unknown,
	Output = Input
> = {
	/**
	* The Standard Schema properties.
	*/
	readonly "~standard": StandardSchemaV1.Props<Input, Output>;
};
interface RefinementCtx {
	addIssue: (arg: IssueData) => void;
	path: (string | number)[];
}
type ZodTypeAny = ZodType<any, any, any>;
type input<T extends ZodType<any, any, any>> = T["_input"];
type output<T extends ZodType<any, any, any>> = T["_output"];
type CustomErrorParams = Partial<util.Omit<ZodCustomIssue, "code">>;
interface ZodTypeDef {
	errorMap?: ZodErrorMap | undefined;
	description?: string | undefined;
}
type RawCreateParams = {
	errorMap?: ZodErrorMap | undefined;
	invalid_type_error?: string | undefined;
	required_error?: string | undefined;
	message?: string | undefined;
	description?: string | undefined;
} | undefined;
type SafeParseSuccess<Output> = {
	success: true;
	data: Output;
	error?: never;
};
type SafeParseError<Input> = {
	success: false;
	error: ZodError<Input>;
	data?: never;
};
type SafeParseReturnType<
	Input,
	Output
> = SafeParseSuccess<Output> | SafeParseError<Input>;
declare abstract class ZodType<
	Output = any,
	Def extends ZodTypeDef = ZodTypeDef,
	Input = Output
> {
	readonly _type: Output;
	readonly _output: Output;
	readonly _input: Input;
	readonly _def: Def;
	get description(): string | undefined;
	"~standard": StandardSchemaV1.Props<Input, Output>;
	_getType(input: ParseInput): string;
	_getOrReturnCtx(input: ParseInput, ctx?: ParseContext | undefined): ParseContext;
	_processInputParams(input: ParseInput): {
		status: ParseStatus;
		ctx: ParseContext;
	};
	_parseSync(input: ParseInput): SyncParseReturnType<Output>;
	_parseAsync(input: ParseInput): AsyncParseReturnType<Output>;
	parse(data: unknown, params?: util.InexactPartial<ParseParams>): Output;
	safeParse(data: unknown, params?: util.InexactPartial<ParseParams>): SafeParseReturnType<Input, Output>;
	"~validate"(data: unknown): StandardSchemaV1.Result<Output> | Promise<StandardSchemaV1.Result<Output>>;
	parseAsync(data: unknown, params?: util.InexactPartial<ParseParams>): Promise<Output>;
	safeParseAsync(data: unknown, params?: util.InexactPartial<ParseParams>): Promise<SafeParseReturnType<Input, Output>>;
	/** Alias of safeParseAsync */
	spa: (data: unknown, params?: util.InexactPartial<ParseParams>) => Promise<SafeParseReturnType<Input, Output>>;
	refine<RefinedOutput extends Output>(check: (arg: Output) => arg is RefinedOutput, message?: string | CustomErrorParams | ((arg: Output) => CustomErrorParams)): ZodEffects<this, RefinedOutput, Input>;
	refine(check: (arg: Output) => unknown | Promise<unknown>, message?: string | CustomErrorParams | ((arg: Output) => CustomErrorParams)): ZodEffects<this, Output, Input>;
	refinement<RefinedOutput extends Output>(check: (arg: Output) => arg is RefinedOutput, refinementData: IssueData | ((arg: Output, ctx: RefinementCtx) => IssueData)): ZodEffects<this, RefinedOutput, Input>;
	refinement(check: (arg: Output) => boolean, refinementData: IssueData | ((arg: Output, ctx: RefinementCtx) => IssueData)): ZodEffects<this, Output, Input>;
	_refinement(refinement: RefinementEffect<Output>["refinement"]): ZodEffects<this, Output, Input>;
	superRefine<RefinedOutput extends Output>(refinement: (arg: Output, ctx: RefinementCtx) => arg is RefinedOutput): ZodEffects<this, RefinedOutput, Input>;
	superRefine(refinement: (arg: Output, ctx: RefinementCtx) => void): ZodEffects<this, Output, Input>;
	superRefine(refinement: (arg: Output, ctx: RefinementCtx) => Promise<void>): ZodEffects<this, Output, Input>;
	constructor(def: Def);
	optional(): ZodOptional2<this>;
	nullable(): ZodNullable<this>;
	nullish(): ZodOptional2<ZodNullable<this>>;
	array(): ZodArray2<this>;
	promise(): ZodPromise<this>;
	or<T extends ZodTypeAny>(option: T): ZodUnion<[this, T]>;
	and<T extends ZodTypeAny>(incoming: T): ZodIntersection<this, T>;
	transform<NewOut>(transform: (arg: Output, ctx: RefinementCtx) => NewOut | Promise<NewOut>): ZodEffects<this, NewOut>;
	default(def: util.noUndefined<Input>): ZodDefault<this>;
	default(def: () => util.noUndefined<Input>): ZodDefault<this>;
	brand<B extends string | number | symbol>(brand?: B): ZodBranded<this, B>;
	catch(def: Output): ZodCatch<this>;
	catch(def: (ctx: {
		error: ZodError;
		input: Input;
	}) => Output): ZodCatch<this>;
	describe(description: string): this;
	pipe<T extends ZodTypeAny>(target: T): ZodPipeline<this, T>;
	readonly(): ZodReadonly<this>;
	isOptional(): boolean;
	isNullable(): boolean;
}
interface ZodArrayDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	type: T;
	typeName: ZodFirstPartyTypeKind.ZodArray2;
	exactLength: {
		value: number;
		message?: string | undefined;
	} | null;
	minLength: {
		value: number;
		message?: string | undefined;
	} | null;
	maxLength: {
		value: number;
		message?: string | undefined;
	} | null;
}
type ArrayCardinality = "many" | "atleastone";
type arrayOutputType<
	T extends ZodTypeAny,
	Cardinality extends ArrayCardinality = "many"
> = Cardinality extends "atleastone" ? [T["_output"], ...T["_output"][]] : T["_output"][];
declare class ZodArray2<
	T extends ZodTypeAny,
	Cardinality extends ArrayCardinality = "many"
> extends ZodType<arrayOutputType<T, Cardinality>, ZodArrayDef<T>, Cardinality extends "atleastone" ? [T["_input"], ...T["_input"][]] : T["_input"][]> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	get element(): T;
	min(minLength: number, message?: errorUtil.ErrMessage): this;
	max(maxLength: number, message?: errorUtil.ErrMessage): this;
	length(len: number, message?: errorUtil.ErrMessage): this;
	nonempty(message?: errorUtil.ErrMessage): ZodArray2<T, "atleastone">;
	static create: <El extends ZodTypeAny>(schema: El, params?: RawCreateParams) => ZodArray2<El>;
}
type ZodUnionOptions = Readonly<[ZodTypeAny, ...ZodTypeAny[]]>;
interface ZodUnionDef<T extends ZodUnionOptions = Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>> extends ZodTypeDef {
	options: T;
	typeName: ZodFirstPartyTypeKind.ZodUnion;
}
declare class ZodUnion<T extends ZodUnionOptions> extends ZodType<T[number]["_output"], ZodUnionDef<T>, T[number]["_input"]> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	get options(): T;
	static create: <Options extends Readonly<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>>(types: Options, params?: RawCreateParams) => ZodUnion<Options>;
}
interface ZodIntersectionDef<
	T extends ZodTypeAny = ZodTypeAny,
	U extends ZodTypeAny = ZodTypeAny
> extends ZodTypeDef {
	left: T;
	right: U;
	typeName: ZodFirstPartyTypeKind.ZodIntersection;
}
declare class ZodIntersection<
	T extends ZodTypeAny,
	U extends ZodTypeAny
> extends ZodType<T["_output"] & U["_output"], ZodIntersectionDef<T, U>, T["_input"] & U["_input"]> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	static create: <
		TSchema extends ZodTypeAny,
		USchema extends ZodTypeAny
	>(left: TSchema, right: USchema, params?: RawCreateParams) => ZodIntersection<TSchema, USchema>;
}
interface ZodPromiseDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	type: T;
	typeName: ZodFirstPartyTypeKind.ZodPromise;
}
declare class ZodPromise<T extends ZodTypeAny> extends ZodType<Promise<T["_output"]>, ZodPromiseDef<T>, Promise<T["_input"]>> {
	unwrap(): T;
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	static create: <Inner extends ZodTypeAny>(schema: Inner, params?: RawCreateParams) => ZodPromise<Inner>;
}
type RefinementEffect<T> = {
	type: "refinement";
	refinement: (arg: T, ctx: RefinementCtx) => any;
};
type TransformEffect<T> = {
	type: "transform";
	transform: (arg: T, ctx: RefinementCtx) => any;
};
type PreprocessEffect<T> = {
	type: "preprocess";
	transform: (arg: T, ctx: RefinementCtx) => any;
};
type Effect<T> = RefinementEffect<T> | TransformEffect<T> | PreprocessEffect<T>;
interface ZodEffectsDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	schema: T;
	typeName: ZodFirstPartyTypeKind.ZodEffects;
	effect: Effect<any>;
}
declare class ZodEffects<
	T extends ZodTypeAny,
	Output = output<T>,
	Input = input<T>
> extends ZodType<Output, ZodEffectsDef<T>, Input> {
	innerType(): T;
	sourceType(): T;
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	static create: <I extends ZodTypeAny>(schema: I, effect: Effect<I["_output"]>, params?: RawCreateParams) => ZodEffects<I, I["_output"]>;
	static createWithPreprocess: <I extends ZodTypeAny>(preprocess: (arg: unknown, ctx: RefinementCtx) => unknown, schema: I, params?: RawCreateParams) => ZodEffects<I, I["_output"], unknown>;
}
interface ZodOptionalDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	innerType: T;
	typeName: ZodFirstPartyTypeKind.ZodOptional2;
}
declare class ZodOptional2<T extends ZodTypeAny> extends ZodType<T["_output"] | undefined, ZodOptionalDef<T>, T["_input"] | undefined> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	unwrap(): T;
	static create: <Inner extends ZodTypeAny>(type: Inner, params?: RawCreateParams) => ZodOptional2<Inner>;
}
interface ZodNullableDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	innerType: T;
	typeName: ZodFirstPartyTypeKind.ZodNullable;
}
declare class ZodNullable<T extends ZodTypeAny> extends ZodType<T["_output"] | null, ZodNullableDef<T>, T["_input"] | null> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	unwrap(): T;
	static create: <Inner extends ZodTypeAny>(type: Inner, params?: RawCreateParams) => ZodNullable<Inner>;
}
interface ZodDefaultDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	innerType: T;
	defaultValue: () => util.noUndefined<T["_input"]>;
	typeName: ZodFirstPartyTypeKind.ZodDefault;
}
declare class ZodDefault<T extends ZodTypeAny> extends ZodType<util.noUndefined<T["_output"]>, ZodDefaultDef<T>, T["_input"] | undefined> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	removeDefault(): T;
	static create: <Inner extends ZodTypeAny>(type: Inner, params: RawCreateParams & {
		default: Inner["_input"] | (() => util.noUndefined<Inner["_input"]>);
	}) => ZodDefault<Inner>;
}
interface ZodCatchDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	innerType: T;
	catchValue: (ctx: {
		error: ZodError;
		input: unknown;
	}) => T["_input"];
	typeName: ZodFirstPartyTypeKind.ZodCatch;
}
declare class ZodCatch<T extends ZodTypeAny> extends ZodType<T["_output"], ZodCatchDef<T>, unknown> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	removeCatch(): T;
	static create: <Inner extends ZodTypeAny>(type: Inner, params: RawCreateParams & {
		catch: Inner["_output"] | (() => Inner["_output"]);
	}) => ZodCatch<Inner>;
}
interface ZodBrandedDef<T extends ZodTypeAny> extends ZodTypeDef {
	type: T;
	typeName: ZodFirstPartyTypeKind.ZodBranded;
}
declare const BRAND: unique symbol;
type BRAND<T extends string | number | symbol> = {
	[BRAND]: { [k in T] : true };
};
declare class ZodBranded<
	T extends ZodTypeAny,
	B extends string | number | symbol
> extends ZodType<T["_output"] & BRAND<B>, ZodBrandedDef<T>, T["_input"]> {
	_parse(input: ParseInput): ParseReturnType<any>;
	unwrap(): T;
}
interface ZodPipelineDef<
	A extends ZodTypeAny,
	B extends ZodTypeAny
> extends ZodTypeDef {
	in: A;
	out: B;
	typeName: ZodFirstPartyTypeKind.ZodPipeline;
}
declare class ZodPipeline<
	A extends ZodTypeAny,
	B extends ZodTypeAny
> extends ZodType<B["_output"], ZodPipelineDef<A, B>, A["_input"]> {
	_parse(input: ParseInput): ParseReturnType<any>;
	static create<
		ASchema extends ZodTypeAny,
		BSchema extends ZodTypeAny
	>(a: ASchema, b: BSchema): ZodPipeline<ASchema, BSchema>;
}
type BuiltIn = (((...args: any[]) => any) | (new (...args: any[]) => any)) | {
	readonly [Symbol.toStringTag]: string;
} | Date | Error | Generator | Promise<unknown> | RegExp;
type MakeReadonly<T> = T extends Map<infer K, infer V> ? ReadonlyMap<K, V> : T extends Set<infer V> ? ReadonlySet<V> : T extends [infer Head, ...infer Tail] ? readonly [Head, ...Tail] : T extends Array<infer V> ? ReadonlyArray<V> : T extends BuiltIn ? T : Readonly<T>;
interface ZodReadonlyDef<T extends ZodTypeAny = ZodTypeAny> extends ZodTypeDef {
	innerType: T;
	typeName: ZodFirstPartyTypeKind.ZodReadonly;
}
declare class ZodReadonly<T extends ZodTypeAny> extends ZodType<MakeReadonly<T["_output"]>, ZodReadonlyDef<T>, MakeReadonly<T["_input"]>> {
	_parse(input: ParseInput): ParseReturnType<this["_output"]>;
	static create: <Inner extends ZodTypeAny>(type: Inner, params?: RawCreateParams) => ZodReadonly<Inner>;
	unwrap(): T;
}
declare enum ZodFirstPartyTypeKind {
	ZodString2 = "ZodString",
	ZodNumber2 = "ZodNumber",
	ZodNaN = "ZodNaN",
	ZodBigInt = "ZodBigInt",
	ZodBoolean = "ZodBoolean",
	ZodDate = "ZodDate",
	ZodSymbol = "ZodSymbol",
	ZodUndefined = "ZodUndefined",
	ZodNull = "ZodNull",
	ZodAny = "ZodAny",
	ZodUnknown2 = "ZodUnknown",
	ZodNever = "ZodNever",
	ZodVoid = "ZodVoid",
	ZodArray2 = "ZodArray",
	ZodObject2 = "ZodObject",
	ZodUnion = "ZodUnion",
	ZodDiscriminatedUnion2 = "ZodDiscriminatedUnion",
	ZodIntersection = "ZodIntersection",
	ZodTuple = "ZodTuple",
	ZodRecord = "ZodRecord",
	ZodMap = "ZodMap",
	ZodSet = "ZodSet",
	ZodFunction = "ZodFunction",
	ZodLazy = "ZodLazy",
	ZodLiteral2 = "ZodLiteral",
	ZodEnum2 = "ZodEnum",
	ZodEffects = "ZodEffects",
	ZodNativeEnum = "ZodNativeEnum",
	ZodOptional2 = "ZodOptional",
	ZodNullable = "ZodNullable",
	ZodDefault = "ZodDefault",
	ZodCatch = "ZodCatch",
	ZodPromise = "ZodPromise",
	ZodBranded = "ZodBranded",
	ZodPipeline = "ZodPipeline",
	ZodReadonly = "ZodReadonly"
}
/**
* Tab information schema
*/
declare const TabSchema: exports_external_d.ZodObject<{
	id: exports_external_d.ZodNumber;
	url: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	title: exports_external_d.ZodOptional<exports_external_d.ZodString>;
}>;
/**
* Custom MCP server configuration schema
*/
declare const CustomMcpServerSchema: exports_external_d.ZodObject<{
	name: exports_external_d.ZodString;
	url: exports_external_d.ZodString;
}>;
/**
* Browser context schema
* Contains window, tab, and MCP server information for targeting browser operations
*/
declare const BrowserContextSchema: exports_external_d.ZodObject<{
	windowId: exports_external_d.ZodOptional<exports_external_d.ZodNumber>;
	activeTab: exports_external_d.ZodOptional<typeof TabSchema>;
	selectedTabs: exports_external_d.ZodOptional<exports_external_d.ZodArray<typeof TabSchema>>;
	tabs: exports_external_d.ZodOptional<exports_external_d.ZodArray<typeof TabSchema>>;
	enabledMcpServers: exports_external_d.ZodOptional<exports_external_d.ZodArray<exports_external_d.ZodString>>;
	customMcpServers: exports_external_d.ZodOptional<exports_external_d.ZodArray<typeof CustomMcpServerSchema>>;
}>;
type BrowserContext = exports_external_d.infer<typeof BrowserContextSchema>;
/**
* Supported LLM providers
*/
declare const LLMProviderSchema: exports_external_d.ZodEnum<["anthropic", "openai", "google", "openrouter", "azure", "ollama", "lmstudio", "bedrock", "browseros", "openai-compatible"]>;
type LLMProvider = exports_external_d.infer<typeof LLMProviderSchema>;
/**
* LLM configuration schema
* Used by SDK endpoints and agent configuration
*/
declare const LLMConfigSchema: exports_external_d.ZodObject<{
	provider: typeof LLMProviderSchema;
	model: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	apiKey: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	baseUrl: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	resourceName: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	region: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	accessKeyId: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	secretAccessKey: exports_external_d.ZodOptional<exports_external_d.ZodString>;
	sessionToken: exports_external_d.ZodOptional<exports_external_d.ZodString>;
}>;
type LLMConfig = exports_external_d.infer<typeof LLMConfigSchema>;
declare const StartEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"start">;
	messageId: exports_external_d.ZodOptional<exports_external_d.ZodString>;
}>;
declare const StartStepEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"start-step">;
}>;
declare const FinishStepEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"finish-step">;
}>;
declare const FinishEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"finish">;
	finishReason: exports_external_d.ZodString;
	messageMetadata: exports_external_d.ZodOptional<exports_external_d.ZodUnknown>;
}>;
declare const AbortEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"abort">;
}>;
declare const ErrorEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"error">;
	errorText: exports_external_d.ZodString;
}>;
declare const TextStartEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"text-start">;
	id: exports_external_d.ZodString;
}>;
declare const TextDeltaEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"text-delta">;
	id: exports_external_d.ZodString;
	delta: exports_external_d.ZodString;
}>;
declare const TextEndEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"text-end">;
	id: exports_external_d.ZodString;
}>;
declare const ReasoningStartEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"reasoning-start">;
	id: exports_external_d.ZodString;
}>;
declare const ReasoningDeltaEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"reasoning-delta">;
	id: exports_external_d.ZodString;
	delta: exports_external_d.ZodString;
}>;
declare const ReasoningEndEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"reasoning-end">;
	id: exports_external_d.ZodString;
}>;
declare const ToolInputStartEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-input-start">;
	toolCallId: exports_external_d.ZodString;
	toolName: exports_external_d.ZodString;
}>;
declare const ToolInputDeltaEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-input-delta">;
	toolCallId: exports_external_d.ZodString;
	inputTextDelta: exports_external_d.ZodString;
}>;
declare const ToolInputAvailableEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-input-available">;
	toolCallId: exports_external_d.ZodString;
	toolName: exports_external_d.ZodString;
	input: exports_external_d.ZodUnknown;
}>;
declare const ToolInputErrorEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-input-error">;
	toolCallId: exports_external_d.ZodString;
	errorText: exports_external_d.ZodString;
}>;
declare const ToolOutputAvailableEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-output-available">;
	toolCallId: exports_external_d.ZodString;
	output: exports_external_d.ZodUnknown;
}>;
declare const ToolOutputErrorEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"tool-output-error">;
	toolCallId: exports_external_d.ZodString;
	errorText: exports_external_d.ZodString;
}>;
declare const SourceUrlEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"source-url">;
	sourceId: exports_external_d.ZodString;
	url: exports_external_d.ZodString;
	title: exports_external_d.ZodOptional<exports_external_d.ZodString>;
}>;
declare const FileEventSchema: exports_external_d.ZodObject<{
	type: exports_external_d.ZodLiteral<"file">;
	url: exports_external_d.ZodString;
	mediaType: exports_external_d.ZodString;
}>;
/**
* Zod schema for UIMessageStreamEvent validation.
* The type is derived from this schema - single source of truth.
*/
declare const UIMessageStreamEventSchema: exports_external_d.ZodDiscriminatedUnion<"type", [typeof StartEventSchema, typeof StartStepEventSchema, typeof FinishStepEventSchema, typeof FinishEventSchema, typeof AbortEventSchema, typeof ErrorEventSchema, typeof TextStartEventSchema, typeof TextDeltaEventSchema, typeof TextEndEventSchema, typeof ReasoningStartEventSchema, typeof ReasoningDeltaEventSchema, typeof ReasoningEndEventSchema, typeof ToolInputStartEventSchema, typeof ToolInputDeltaEventSchema, typeof ToolInputAvailableEventSchema, typeof ToolInputErrorEventSchema, typeof ToolOutputAvailableEventSchema, typeof ToolOutputErrorEventSchema, typeof SourceUrlEventSchema, typeof FileEventSchema]>;
/**
* UI Message Stream events (Vercel AI SDK format).
* Derived from UIMessageStreamEventSchema.
*/
type UIMessageStreamEvent = exports_external_d.infer<typeof UIMessageStreamEventSchema>;
/**
* Configuration options for creating an Agent instance.
* @internal Used by runtime - not needed in generated code
*/
interface AgentOptions {
	url: string;
	llm?: LLMConfig;
	/** Browser context for targeting specific windows/tabs and MCP servers */
	browserContext?: BrowserContext;
	/** Callback for streaming UI events (Vercel AI SDK format) */
	onProgress?: (event: UIMessageStreamEvent) => void;
	signal?: AbortSignal;
	/**
	* Enable stateful mode where conversation history persists across act() calls.
	* When true, the agent "remembers" previous interactions.
	* @default true
	*/
	stateful?: boolean;
}
/**
* Options for the `nav()` method.
*/
interface NavOptions {
	/** Target a specific tab by ID */
	tabId?: number;
	/** Target a specific window by ID */
	windowId?: number;
}
/**
* Options for the `act()` method.
*/
interface ActOptions {
	/** Key-value pairs to interpolate into the instruction using `{{key}}` syntax */
	context?: Record<string, unknown>;
	/** Maximum number of steps for multi-step actions (default: 10) */
	maxSteps?: number;
	/** Target a specific window by ID */
	windowId?: number;
	/**
	* Reset conversation state for this act() call.
	* Starts fresh and continues with the new state for subsequent calls.
	* @default false
	*/
	resetState?: boolean;
	/**
	* Condition to verify after action succeeds.
	* If verification fails, the action is retried up to `maxRetries` times.
	* @example 'Cart shows 1 item'
	*/
	verify?: string;
	/**
	* Maximum retry attempts when verification fails.
	* Only used when `verify` is set.
	* @default 1
	*/
	maxRetries?: number;
}
/**
* Options for the `extract()` method.
*/
interface ExtractOptions<T> {
	/** Zod schema defining the expected data structure */
	schema: ZodType<T>;
	/** Optional key-value pairs for additional context */
	context?: Record<string, unknown>;
}
/**
* Options for the `verify()` method.
*/
interface VerifyOptions {
	/** Optional key-value pairs for additional context */
	context?: Record<string, unknown>;
}
/**
* Types of progress events emitted by agent methods.
*/
type ProgressEventType = "nav" | "act" | "extract" | "verify" | "error" | "done";
/**
* Progress event emitted during agent operations.
*/
interface ProgressEvent {
	/** The type of operation */
	type: ProgressEventType;
	/** Human-readable description of the current operation */
	message: string;
	/** Additional metadata about the operation */
	metadata?: Record<string, unknown>;
}
/**
* Result returned by `nav()`.
*/
interface NavResult {
	/** Whether navigation succeeded */
	success: boolean;
}
/**
* Result returned by `act()`.
*/
interface ActResult {
	/** Whether the action succeeded */
	success: boolean;
	/** The steps executed to complete the action */
	steps: ActStep[];
}
/**
* A single step executed during an `act()` call.
*/
interface ActStep {
	/** The agent's reasoning for this step */
	thought?: string;
	/** Tool calls made during this step */
	toolCalls?: ToolCall[];
}
/**
* A tool call made during action execution.
*/
interface ToolCall {
	/** Name of the tool that was called */
	name: string;
	/** Arguments passed to the tool */
	args: Record<string, unknown>;
	/** Result returned by the tool */
	result?: unknown;
	/** Error message if the tool call failed */
	error?: string;
}
/**
* Result returned by `extract()`.
*/
interface ExtractResult<T> {
	/** The extracted data matching the provided schema */
	data: T;
}
/**
* Result returned by `verify()`.
*/
interface VerifyResult {
	/** Whether the verification passed */
	success: boolean;
	/** Explanation of why verification passed or failed */
	reason: string;
}
/**
* Context interface that method modules use to access agent state and utilities.
* The Agent class implements this interface.
*/
interface AgentContext {
	readonly baseUrl: string;
	readonly llmConfig?: LLMConfig;
	readonly browserContext?: BrowserContext;
	readonly signal?: AbortSignal;
	readonly stateful: boolean;
	sessionId: string | null;
	emit(event: UIMessageStreamEvent): void;
	throwIfAborted(): void;
}
/**
* Browser automation agent for the BrowserOS platform.
* Provides high-level methods to navigate, interact, extract data, and verify page state.
*
* @remarks
* The Agent instance is injected by the runtime - never instantiate it directly.
* Export a `run` function that receives the agent as a parameter.
*
* @example
* ```typescript
* import type { Agent } from '@browseros-ai/agent-sdk'
* import { z } from 'zod'
*
* async function run(agent: Agent) {
*   await agent.nav('https://example.com')
*   await agent.act('click the login button')
*   const { data } = await agent.extract('get page title', {
*     schema: z.object({ title: z.string() })
*   })
*   return { message: 'Done', data }
* }
* ```
*/
declare class Agent implements AsyncDisposable, AgentContext {
	readonly baseUrl: string;
	readonly llmConfig?: LLMConfig;
	readonly signal?: AbortSignal;
	readonly browserContext?: BrowserContext;
	readonly stateful: boolean;
	private progressCallback?;
	private _sessionId;
	private _disposed;
	constructor(options: AgentOptions);
	get sessionId(): string | null;
	set sessionId(value: string | null);
	dispose(): Promise<void>;
	[Symbol.asyncDispose](): Promise<void>;
	throwIfAborted(): void;
	onProgress(callback: (event: UIMessageStreamEvent) => void): void;
	emit(event: UIMessageStreamEvent): void;
	/**
	* Navigate to a URL and wait for the page to load.
	*
	* @param url - The URL to navigate to (must be a valid HTTP/HTTPS URL)
	* @param options - Optional navigation settings
	* @returns Promise resolving to `{ success: boolean }`
	* @throws {NavigationError} When navigation fails
	*
	* @example
	* ```typescript
	* const { success } = await agent.nav('https://google.com')
	* ```
	*/
	nav(url: string, options?: NavOptions): Promise<NavResult>;
	/**
	* Perform a browser action described in natural language.
	*
	* @param instruction - Natural language description of the action
	* @param options - Optional action settings including optional verification
	* @returns Promise resolving to `{ success: boolean, steps: ActStep[] }`
	* @throws {ActionError} When the action fails
	*
	* @example
	* ```typescript
	* // Simple action
	* await agent.act('click the login button')
	*
	* // With verification and retry
	* await agent.act('Click Add to Cart', {
	*   verify: 'Cart shows 1 item',
	*   maxRetries: 2
	* })
	*
	* // With context interpolation
	* await agent.act('search for {{query}}', {
	*   context: { query: 'wireless headphones' }
	* })
	* ```
	*/
	act(instruction: string, options?: ActOptions): Promise<ActResult>;
	/**
	* Extract structured data from the current page using natural language.
	*
	* @param instruction - Natural language description of what data to extract
	* @param options - Extraction options with Zod schema
	* @returns Promise resolving to `{ data: T }`
	* @throws {ExtractionError} When extraction fails
	*
	* @example
	* ```typescript
	* import { z } from 'zod'
	*
	* const { data } = await agent.extract('get product info', {
	*   schema: z.object({
	*     name: z.string(),
	*     price: z.number()
	*   })
	* })
	* ```
	*/
	extract<T>(instruction: string, options: ExtractOptions<T>): Promise<ExtractResult<T>>;
	/**
	* Verify that the current page matches an expected state.
	*
	* @param expectation - Natural language description of expected state
	* @param options - Optional verification settings
	* @returns Promise resolving to `{ success: boolean, reason: string }`
	* @throws {VerificationError} When verification cannot be performed
	*
	* @example
	* ```typescript
	* const { success, reason } = await agent.verify('login form is visible')
	* ```
	*/
	verify(expectation: string, options?: VerifyOptions): Promise<VerifyResult>;
}
/**
* Base error class for all Agent SDK errors.
* All SDK errors extend this class.
*/
declare class AgentSDKError extends Error {
	readonly code: string;
	readonly statusCode?: number | undefined;
	constructor(message: string, code: string, statusCode?: number | undefined);
}
/**
* Thrown when the agent cannot connect to the BrowserOS runtime.
*/
declare class ConnectionError extends AgentSDKError {
	readonly url: string;
	constructor(message: string, url: string);
}
/**
* Thrown when `nav()` fails to navigate to the target URL.
*/
declare class NavigationError extends AgentSDKError {
	constructor(message: string, statusCode?: number);
}
/**
* Thrown when `act()` fails to perform the requested action.
*/
declare class ActionError extends AgentSDKError {
	constructor(message: string, statusCode?: number);
}
/**
* Thrown when `extract()` fails to extract data or data doesn't match schema.
*/
declare class ExtractionError extends AgentSDKError {
	constructor(message: string, statusCode?: number);
}
/**
* Thrown when `verify()` encounters an error during verification.
*/
declare class VerificationError extends AgentSDKError {
	constructor(message: string, statusCode?: number);
}
export { VerifyResult, VerifyOptions, VerificationError, UIMessageStreamEvent, ToolCall, ProgressEventType, ProgressEvent, NavigationError, NavResult, NavOptions, LLMProvider, LLMConfig, ExtractionError, ExtractResult, ExtractOptions, ConnectionError, BrowserContext, AgentSDKError, AgentOptions, Agent, ActionError, ActStep, ActResult, ActOptions };
