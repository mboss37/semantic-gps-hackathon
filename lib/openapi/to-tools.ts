// OpenAPI 3.x → MCP tool descriptors. Pure transform; no network, no DB.
// Scope-tight: path+method → one tool, path+query params map to input-schema
// properties, application/json request body nests under `body`. header/cookie
// params are ignored. Missing operationId falls back to `${method}_${slug(path)}`.

export type OpenApiSpec = {
  info?: { title?: string; version?: string };
  paths?: Record<string, PathItem>;
};

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
const HTTP_METHODS: readonly HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch'];

type PathItem = Partial<Record<HttpMethod, Operation>>;

type Parameter = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
};

type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: { 'application/json'?: { schema?: Record<string, unknown> } };
  };
};

export type ToolInputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export type McpToolDescriptor = {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
  meta: {
    method: HttpMethod;
    path: string;
    operation_id?: string;
  };
};

const slug = (s: string): string =>
  s
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const operationToTool = (method: HttpMethod, path: string, op: Operation): McpToolDescriptor => {
  const name = op.operationId ?? `${method}_${slug(path)}`;
  const description = op.summary ?? op.description ?? `${method.toUpperCase()} ${path}`;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of op.parameters ?? []) {
    if (param.in === 'header' || param.in === 'cookie') continue;
    const schema = param.schema ?? { type: 'string' };
    properties[param.name] = param.description
      ? { ...schema, description: param.description }
      : schema;
    if (param.required) required.push(param.name);
  }

  const bodySchema = op.requestBody?.content?.['application/json']?.schema;
  if (bodySchema) {
    properties.body = bodySchema;
    if (op.requestBody?.required) required.push('body');
  }

  const input_schema: ToolInputSchema = { type: 'object', properties };
  if (required.length > 0) input_schema.required = required;

  return {
    name,
    description,
    input_schema,
    meta: {
      method,
      path,
      ...(op.operationId ? { operation_id: op.operationId } : {}),
    },
  };
};

export const openApiToTools = (spec: OpenApiSpec): McpToolDescriptor[] => {
  const tools: McpToolDescriptor[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      tools.push(operationToTool(method, path, op));
    }
  }
  return tools;
};
